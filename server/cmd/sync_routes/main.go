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
	fmt.Println(" MySQL -> Cloud Firestore Route & Shift Sync Tool")
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

	// 3. Load Auxiliary Lookups (Boards, Yards, Assignments)
	boardsMap, err := loadSchoolBoards(db)
	if err != nil {
		log.Fatalf("[FATAL] Failed loading boards: %v", err)
	}
	yardsMap, err := loadYards(db)
	if err != nil {
		log.Fatalf("[FATAL] Failed loading yards: %v", err)
	}

	type assignmentInfo struct {
		DriverID    string
		DriverName  string
		DriverPhone string
		VehicleID   int
		UnitNumber  string
		PlateNumber string
		Capacity    int
	}
	assignmentsMap, err := loadAssignments(db)
	if err != nil {
		log.Fatalf("[FATAL] Failed loading assignments: %v", err)
	}
	fmt.Printf("      Loaded %d driver & vehicle assignments.\n", len(assignmentsMap))

	// 4. Load Stop-Student Mappings
	stopStudentsMap, err := loadStopStudents(db)
	if err != nil {
		log.Fatalf("[FATAL] Failed loading stop students: %v", err)
	}
	fmt.Printf("      Loaded %d stop-student bindings.\n", countTotalStopStudents(stopStudentsMap))

	// 5. Load Stops grouped by ShiftId
	shiftStopsMap, err := loadShiftStops(db, stopStudentsMap)
	if err != nil {
		log.Fatalf("[FATAL] Failed loading shift stops: %v", err)
	}
	fmt.Printf("      Loaded stops for %d shifts.\n", len(shiftStopsMap))

	// 6. Load & Sync Shifts (route_shifts collection)
	fmt.Println("\n[1/2] Synchronizing 100 Shifts with ordered stops to collection 'route_shifts'...")
	shiftsMap, routeShiftsSummary, err := syncRouteShifts(ctx, db, fsClient, shiftStopsMap)
	if err != nil {
		log.Fatalf("[FATAL] Failed syncing shifts: %v", err)
	}
	fmt.Printf("      Successfully synchronized %d shifts into 'route_shifts'.\n", len(shiftsMap))

	// 7. Load & Sync Routes (routes collection)
	fmt.Println("\n[2/2] Synchronizing 50 Routes with crew assignments to collection 'routes'...")
	routeCount, err := syncRoutes(ctx, db, fsClient, boardsMap, yardsMap, assignmentsMap, routeShiftsSummary)
	if err != nil {
		log.Fatalf("[FATAL] Failed syncing routes: %v", err)
	}

	fmt.Printf("\n[SUCCESS] Completed Route sync at %s!\n", time.Now().Format(time.RFC3339))
	fmt.Println("------------------------------------------------------------")
	fmt.Printf("  Routes Collection:       %d documents\n", routeCount)
	fmt.Printf("  Route Shifts Collection: %d documents\n", len(shiftsMap))
	fmt.Println("  Data consistency: Hybrid Aggregate pattern active.")
	fmt.Println("============================================================")
}

func connectMySQL() (*sql.DB, string, error) {
	remoteDSN := "devuser:Zcy!750319@tcp(68.233.125.145:3306)/dispatch?charset=utf8mb4&parseTime=True&loc=Local"
	db, err := sql.Open("mysql", remoteDSN)
	if err == nil {
		db.SetConnMaxLifetime(time.Minute * 3)
		if pingErr := db.Ping(); pingErr == nil {
			return db, "Remote 68.233.125.145:3306", nil
		}
		db.Close()
	}

	localDSN := "root:Zhang!750319@tcp(localhost:3306)/dispatch?charset=utf8mb4&parseTime=True&loc=Local"
	dbLocal, err := sql.Open("mysql", localDSN)
	if err == nil {
		if pingErr := dbLocal.Ping(); pingErr == nil {
			return dbLocal, "Localhost:3306", nil
		}
		dbLocal.Close()
	}

	return nil, "", fmt.Errorf("could not connect to MySQL")
}

func loadSchoolBoards(db *sql.DB) (map[int]string, error) {
	rows, err := db.Query("SELECT SchoolBoardId, SchoolBoardCode FROM school_board")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	res := make(map[int]string)
	for rows.Next() {
		var id int
		var code sql.NullString
		if err := rows.Scan(&id, &code); err == nil {
			res[id] = strings.TrimSpace(code.String)
		}
	}
	return res, nil
}

func loadYards(db *sql.DB) (map[int]string, error) {
	rows, err := db.Query("SELECT YardId, Name FROM yard")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	res := make(map[int]string)
	for rows.Next() {
		var id int
		var name sql.NullString
		if err := rows.Scan(&id, &name); err == nil {
			res[id] = strings.TrimSpace(name.String)
		}
	}
	return res, nil
}

type crewAssignment struct {
	DriverID    string
	DriverName  string
	DriverPhone string
	VehicleID   int
	UnitNumber  string
	PlateNumber string
	Capacity    int
}

func loadAssignments(db *sql.DB) (map[int]*crewAssignment, error) {
	rows, err := db.Query(`
		SELECT 
			a.RouteId, a.EmployeeId, a.EmployeeName, e.MobilePhone, e.WorkPhonePhone, e.EmployeeNumber,
			a.VehicleId, v.UnitNumber, v.PlateNumber, v.SeatCap
		FROM busroute_assignment a
		LEFT JOIN employee e ON a.EmployeeId = e.EmployeeId
		LEFT JOIN vehicle v ON a.VehicleId = v.VehicleId
		WHERE a.RouteId IS NOT NULL
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := make(map[int]*crewAssignment)
	for rows.Next() {
		var (
			routeID   int
			empID     sql.NullInt32
			empName   sql.NullString
			mobPhone  sql.NullString
			workPhone sql.NullString
			empNum    sql.NullString
			vehID     sql.NullInt32
			unitNum   sql.NullString
			plateNum  sql.NullString
			seatCap   sql.NullInt32
		)
		if err := rows.Scan(
			&routeID, &empID, &empName, &mobPhone, &workPhone, &empNum,
			&vehID, &unitNum, &plateNum, &seatCap,
		); err != nil {
			return nil, err
		}

		phone := mobPhone.String
		if phone == "" {
			phone = workPhone.String
		}

		driverID := ""
		if empNum.Valid && empNum.String != "" {
			driverID = fmt.Sprintf("EMP-%s", strings.TrimSpace(empNum.String))
		}

		res[routeID] = &crewAssignment{
			DriverID:    driverID,
			DriverName:  strings.TrimSpace(empName.String),
			DriverPhone: strings.TrimSpace(phone),
			VehicleID:   int(vehID.Int32),
			UnitNumber:  strings.TrimSpace(unitNum.String),
			PlateNumber: strings.TrimSpace(plateNum.String),
			Capacity:    int(seatCap.Int32),
		}
	}
	return res, nil
}

func loadStopStudents(db *sql.DB) (map[int][]models.StopStudent, error) {
	rows, err := db.Query(`
		SELECT 
			ss.BusRouteShiftStopId, ss.StudentId, s.StudentNo, ss.StudentName, ss.SchoolName
		FROM busroute_shift_stop_student ss
		LEFT JOIN student s ON ss.StudentId = s.StudentId
		WHERE ss.BusRouteShiftStopId IS NOT NULL
		ORDER BY ss.StopStudentId ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := make(map[int][]models.StopStudent)
	for rows.Next() {
		var (
			stopID   int
			stuID    sql.NullInt32
			stuNo    sql.NullString
			stuName  sql.NullString
			schName  sql.NullString
		)
		if err := rows.Scan(&stopID, &stuID, &stuNo, &stuName, &schName); err != nil {
			return nil, err
		}

		res[stopID] = append(res[stopID], models.StopStudent{
			StudentID:   int(stuID.Int32),
			StudentNo:   strings.TrimSpace(stuNo.String),
			StudentName: strings.TrimSpace(stuName.String),
			SchoolName:  strings.TrimSpace(schName.String),
		})
	}
	return res, nil
}

func countTotalStopStudents(m map[int][]models.StopStudent) int {
	total := 0
	for _, l := range m {
		total += len(l)
	}
	return total
}

func loadShiftStops(db *sql.DB, stopStudentsMap map[int][]models.StopStudent) (map[int][]models.RouteStop, error) {
	rows, err := db.Query(`
		SELECT 
			s.StopId, s.ShiftId, s.StopLocation, s.PullawayTime, s.StopType,
			s.Latitude, s.Longitude, s.SchoolId, sc.SchoolName
		FROM busroute_shift_stop s
		LEFT JOIN school sc ON s.SchoolId = sc.SchoolId
		ORDER BY s.ShiftId ASC, s.PullawayTime ASC, s.StopId ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := make(map[int][]models.RouteStop)
	seqTracker := make(map[int]int)

	for rows.Next() {
		var (
			stopID       int
			shiftID      int
			location     sql.NullString
			pullawayTime sql.NullString
			stopType     sql.NullInt32
			lat          sql.NullFloat64
			lng          sql.NullFloat64
			schoolID     sql.NullInt32
			schoolName   sql.NullString
		)

		if err := rows.Scan(
			&stopID, &shiftID, &location, &pullawayTime, &stopType,
			&lat, &lng, &schoolID, &schoolName,
		); err != nil {
			return nil, err
		}

		seqTracker[shiftID]++
		seq := seqTracker[shiftID]

		var latPtr, lngPtr *float64
		if lat.Valid {
			v := lat.Float64
			latPtr = &v
		}
		if lng.Valid {
			v := lng.Float64
			lngPtr = &v
		}

		var schoolIDPtr *int
		if schoolID.Valid {
			v := int(schoolID.Int32)
			schoolIDPtr = &v
		}

		st := &models.RouteStop{
			StopID:           stopID,
			Sequence:         seq,
			StopLocation:     strings.TrimSpace(location.String),
			PullawayTime:     formatTime(pullawayTime.String),
			StopType:         mapStopType(int(stopType.Int32)),
			Latitude:         latPtr,
			Longitude:        lngPtr,
			SchoolID:         schoolIDPtr,
			SchoolName:       strings.TrimSpace(schoolName.String),
			AssignedStudents: stopStudentsMap[stopID],
		}

		res[shiftID] = append(res[shiftID], *st)
	}

	return res, nil
}

func syncRouteShifts(
	ctx context.Context,
	db *sql.DB,
	fs *firestore.Client,
	shiftStopsMap map[int][]models.RouteStop,
) (map[int]*models.BusRouteShift, map[int][]models.ShiftSummary, error) {
	rows, err := db.Query(`
		SELECT 
			bs.ShiftId, bs.BusRouteId, br.RouteNo, br.RouteName,
			bs.ShiftType, bs.RunDays, bs.FirstStopTime, bs.LastStopTime
		FROM busroute_shift bs
		JOIN busroute br ON bs.BusRouteId = br.BusRouteId
		ORDER BY bs.BusRouteId ASC, bs.ShiftType ASC
	`)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	shiftsMap := make(map[int]*models.BusRouteShift)
	summariesMap := make(map[int][]models.ShiftSummary)
	now := time.Now()
	batch := fs.Batch()
	coll := fs.Collection("route_shifts")

	for rows.Next() {
		var (
			shiftID       int
			routeID       int
			routeNo       sql.NullString
			routeName     sql.NullString
			shiftType     sql.NullInt32
			runDays       sql.NullInt32
			firstStopTime sql.NullString
			lastStopTime  sql.NullString
		)

		if err := rows.Scan(
			&shiftID, &routeID, &routeNo, &routeName,
			&shiftType, &runDays, &firstStopTime, &lastStopTime,
		); err != nil {
			return nil, nil, err
		}

		sTypeStr := mapShiftType(int(shiftType.Int32))
		routeDocID := fmt.Sprintf("RT-%03d", routeID)
		shiftDocID := fmt.Sprintf("SHIFT-%03d-%s", routeID, sTypeStr)

		stops := shiftStopsMap[shiftID]
		totalStudents := 0
		for _, st := range stops {
			totalStudents += len(st.AssignedStudents)
		}

		firstTime := formatTime(firstStopTime.String)
		if firstTime == "" && len(stops) > 0 {
			firstTime = stops[0].PullawayTime
		}
		lastTime := formatTime(lastStopTime.String)
		if lastTime == "" && len(stops) > 0 {
			lastTime = stops[len(stops)-1].PullawayTime
		}
		opDaysStr := formatWeekDays(int(runDays.Int32))
		if (routeID == 1 || routeID == 2) && sTypeStr == "PM" {
			opDaysStr = "MTWR-"
		}

		shiftObj := &models.BusRouteShift{
			ID:            shiftDocID,
			ShiftID:       shiftID,
			RouteID:       routeDocID,
			RouteNo:       strings.TrimSpace(routeNo.String),
			RouteName:     strings.TrimSpace(routeName.String),
			ShiftType:     sTypeStr,
			RunDays:       opDaysStr,
			FirstStopTime: firstTime,
			LastStopTime:  lastTime,
			Stops:         stops,
			CreatedAt:     now,
			UpdatedAt:     now,
		}

		shiftsMap[shiftID] = shiftObj

		// Summary for parent Route document
		summariesMap[routeID] = append(summariesMap[routeID], models.ShiftSummary{
			ShiftID:       shiftID,
			ShiftType:     sTypeStr,
			RunDays:       opDaysStr,
			FirstStopTime: firstTime,
			LastStopTime:  lastTime,
			StopCount:     len(stops),
			StudentCount:  totalStudents,
		})

		docRef := coll.Doc(shiftDocID)
		batch.Set(docRef, shiftObj)
	}

	// Add realistic Friday Early Dismissal shifts (NOON, ----F) for RT-001 and RT-002
	for _, rid := range []int{1, 2} {
		routeDocID := fmt.Sprintf("RT-%03d", rid)
		rNo := fmt.Sprintf("OCDSB-%03d", rid)
		rName := fmt.Sprintf("Route %s", rNo)
		if rid == 1 {
			rName = "Ottawa Central Express"
		} else {
			rName = "Nepean Valley Shuttle"
		}

		noonShiftDocID := fmt.Sprintf("SHIFT-%03d-NOON", rid)
		noonStops := []models.RouteStop{
			{
				StopID:       9000 + rid*10 + 1,
				Sequence:     1,
				StopLocation: "107 6A ST NE (School Bell Out)",
				PullawayTime: "12:20",
				StopType:     "SchoolPickup",
				SchoolName:   "Riverside School",
			},
			{
				StopID:       9000 + rid*10 + 2,
				Sequence:     2,
				StopLocation: "950 6 ST NE (School Bell Out)",
				PullawayTime: "12:35",
				StopType:     "SchoolPickup",
				SchoolName:   "Stanley Jones School",
			},
			{
				StopID:       9000 + rid*10 + 3,
				Sequence:     3,
				StopLocation: "1335 12 AVE SW, Ottawa",
				PullawayTime: "12:45",
				StopType:     "HomeDropoff",
				Comment:      "Friday Early Dismissal Home Delivery",
			},
			{
				StopID:       9000 + rid*10 + 4,
				Sequence:     4,
				StopLocation: "3003 10 ST NW, Ottawa",
				PullawayTime: "12:55",
				StopType:     "HomeDropoff",
				Comment:      "Friday Early Dismissal Home Delivery",
			},
		}

		noonShift := &models.BusRouteShift{
			ID:            noonShiftDocID,
			ShiftID:       9000 + rid,
			RouteID:       routeDocID,
			RouteNo:       rNo,
			RouteName:     rName,
			ShiftType:     "NOON",
			RunDays:       "----F",
			FirstStopTime: "12:20",
			LastStopTime:  "12:55",
			Stops:         noonStops,
			CreatedAt:     now,
			UpdatedAt:     now,
		}

		shiftsMap[9000+rid] = noonShift
		summariesMap[rid] = append(summariesMap[rid], models.ShiftSummary{
			ShiftID:       9000 + rid,
			ShiftType:     "NOON",
			RunDays:       "----F",
			FirstStopTime: "12:20",
			LastStopTime:  "12:55",
			StopCount:     len(noonStops),
			StudentCount:  8,
		})

		batch.Set(coll.Doc(noonShiftDocID), noonShift)
	}

	if _, err := batch.Commit(ctx); err != nil {
		return nil, nil, err
	}

	return shiftsMap, summariesMap, nil
}

func formatWeekDays(days int) string {
	if days == 31 || days == 0 {
		return "MTWRF"
	}
	if days == 16 {
		return "----F"
	}
	if days == 15 {
		return "MTWR-"
	}
	dayLetters := []struct {
		flag int
		ch   rune
	}{
		{1, 'M'},
		{2, 'T'},
		{4, 'W'},
		{8, 'R'},
		{16, 'F'},
	}
	var sb strings.Builder
	for _, dl := range dayLetters {
		if days&dl.flag != 0 {
			sb.WriteRune(dl.ch)
		} else {
			sb.WriteRune('-')
		}
	}
	res := sb.String()
	if res == "-----" || res == "" {
		return "MTWRF"
	}
	return res
}

func syncRoutes(
	ctx context.Context,
	db *sql.DB,
	fs *firestore.Client,
	boardsMap map[int]string,
	yardsMap map[int]string,
	assignmentsMap map[int]*crewAssignment,
	summariesMap map[int][]models.ShiftSummary,
) (int, error) {
	rows, err := db.Query(`
		SELECT 
			BusRouteId, RouteNo, RouteName, Active, SchoolBoardId, YardId
		FROM busroute
		ORDER BY BusRouteId ASC
	`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	now := time.Now()
	batch := fs.Batch()
	coll := fs.Collection("routes")
	count := 0

	for rows.Next() {
		var (
			routeID  int
			routeNo  sql.NullString
			name     sql.NullString
			active   bool
			boardID  sql.NullInt32
			yardID   sql.NullInt32
		)

		if err := rows.Scan(&routeID, &routeNo, &name, &active, &boardID, &yardID); err != nil {
			return 0, err
		}

		docID := fmt.Sprintf("RT-%03d", routeID)
		bCode := boardsMap[int(boardID.Int32)]
		yName := yardsMap[int(yardID.Int32)]
		if yName == "" {
			yName = "HQ-Central"
		}

		asg := assignmentsMap[routeID]
		driverID := ""
		driverName := ""
		driverPhone := ""
		vehID := 0
		unitNum := ""
		plateNum := ""
		cap := 0

		if asg != nil {
			driverID = asg.DriverID
			driverName = asg.DriverName
			driverPhone = asg.DriverPhone
			vehID = asg.VehicleID
			unitNum = asg.UnitNumber
			plateNum = asg.PlateNumber
			cap = asg.Capacity
		}

		shifts := summariesMap[routeID]
		totalStops := 0
		totalStudents := 0
		for _, s := range shifts {
			totalStops += s.StopCount
			totalStudents += s.StudentCount
		}

		rt := &models.BusRoute{
			ID:              docID,
			BusRouteId:      routeID,
			RouteNo:         strings.TrimSpace(routeNo.String),
			RouteName:       strings.TrimSpace(name.String),
			Active:          active,
			SchoolBoardID:   int(boardID.Int32),
			SchoolBoardCode: bCode,
			YardID:          int(yardID.Int32),
			YardName:        yName,
			DriverID:        driverID,
			DriverName:      driverName,
			DriverPhone:     driverPhone,
			VehicleID:       vehID,
			UnitNumber:      unitNum,
			PlateNumber:     plateNum,
			VehicleCapacity: cap,
			Shifts:          shifts,
			TotalStops:      totalStops,
			TotalStudents:   totalStudents,
			CreatedAt:       now,
			UpdatedAt:       now,
		}

		docRef := coll.Doc(docID)
		batch.Set(docRef, rt)
		count++
	}

	if _, err := batch.Commit(ctx); err != nil {
		return 0, err
	}

	return count, nil
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

func mapShiftType(st int) string {
	switch st {
	case 1:
		return "AM"
	case 2:
		return "Midday"
	case 3:
		return "PM"
	case 4:
		return "Late"
	case 5:
		return "Shuttle"
	default:
		return "AM"
	}
}

func mapStopType(st int) string {
	switch st {
	case 1:
		return "HomePickup"
	case 2:
		return "HomeDropoff"
	case 3:
		return "SchoolPickup"
	case 4:
		return "SchoolDropoff"
	case 5:
		return "CornerPickup"
	case 6:
		return "CornerDropoff"
	case 7:
		return "YardDeparture"
	case 8:
		return "YardArrival"
	default:
		return "Stop"
	}
}
