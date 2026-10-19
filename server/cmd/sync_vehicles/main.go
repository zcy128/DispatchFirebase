package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
	firebase "firebase.google.com/go/v4"
	"google.golang.org/api/option"

	"dispatch-server/internal/config"
	"dispatch-server/internal/models"
)

func main() {
	fmt.Println("============================================================")
	fmt.Println(" MySQL -> Cloud Firestore Vehicle Master Data Sync Tool")
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

	fsClient, err := app.Firestore(ctx)
	if err != nil {
		log.Fatalf("[FATAL] Firestore client error: %v", err)
	}
	defer fsClient.Close()

	// 3. Load active route & driver assignments
	type routeAssignment struct {
		RouteID     int
		RouteNo     string
		RouteName   string
		EmployeeID  int
		DriverName  string
		DriverPhone string
		EmpNumber   string
	}

	assignments := make(map[int]*routeAssignment)
	asgRows, err := db.Query(`
		SELECT 
			ba.VehicleId, ba.RouteId, br.RouteNo, br.RouteName,
			ba.EmployeeId, ba.EmployeeName, e.MobilePhone, e.WorkPhonePhone, e.EmployeeNumber
		FROM busroute_assignment ba
		JOIN busroute br ON ba.RouteId = br.BusRouteId
		LEFT JOIN employee e ON ba.EmployeeId = e.EmployeeId
		WHERE ba.VehicleId IS NOT NULL
	`)
	if err == nil {
		defer asgRows.Close()
		for asgRows.Next() {
			var (
				vID       int
				rID       int
				rNo       sql.NullString
				rName     sql.NullString
				empID     sql.NullInt32
				empName   sql.NullString
				mobPhone  sql.NullString
				workPhone sql.NullString
				empNum    sql.NullString
			)
			if err := asgRows.Scan(&vID, &rID, &rNo, &rName, &empID, &empName, &mobPhone, &workPhone, &empNum); err == nil {
				phone := mobPhone.String
				if phone == "" {
					phone = workPhone.String
				}
				assignments[vID] = &routeAssignment{
					RouteID:     rID,
					RouteNo:     strings.TrimSpace(rNo.String),
					RouteName:   strings.TrimSpace(rName.String),
					EmployeeID:  int(empID.Int32),
					DriverName:  strings.TrimSpace(empName.String),
					DriverPhone: strings.TrimSpace(phone),
					EmpNumber:   strings.TrimSpace(empNum.String),
				}
			}
		}
	}
	fmt.Printf("[OK] Loaded %d route-to-vehicle assignments.\n", len(assignments))

	// 4. Query vehicles
	vRows, err := db.Query(`
		SELECT 
			v.VehicleId, v.UnitNumber, v.PlateNumber, v.Vin, v.Manufacturer, v.Model,
			v.Year, v.Color, v.UnitType, v.SeatCap, v.WheelchairCap, v.FuelType,
			v.LicenseExpiry, v.Active, v.StatusId, v.Notes, v.EmployeeId, v.DriverName
		FROM vehicle v
		ORDER BY v.VehicleId ASC
	`)
	if err != nil {
		log.Fatalf("[FATAL] Querying vehicle table failed: %v", err)
	}
	defer vRows.Close()

	now := time.Now()
	batch := fsClient.Batch()
	coll := fsClient.Collection("vehicles")
	count := 0

	for vRows.Next() {
		var (
			vehicleID     int
			unitNum       sql.NullString
			plateNum      sql.NullString
			vin           sql.NullString
			mfr           sql.NullString
			model         sql.NullString
			year          sql.NullInt32
			color         sql.NullString
			unitType      sql.NullString
			seatCap       sql.NullInt32
			wcCap         sql.NullInt32
			fuelType      sql.NullString
			licExpiry     sql.NullTime
			active        bool
			statusID      sql.NullInt32
			notes         sql.NullString
			empID         sql.NullInt32
			driverNameRow sql.NullString
		)

		if err := vRows.Scan(
			&vehicleID, &unitNum, &plateNum, &vin, &mfr, &model,
			&year, &color, &unitType, &seatCap, &wcCap, &fuelType,
			&licExpiry, &active, &statusID, &notes, &empID, &driverNameRow,
		); err != nil {
			log.Fatalf("[FATAL] Scanning vehicle failed: %v", err)
		}

		docID := fmt.Sprintf("VEH-%03d", vehicleID)
		uType := strings.TrimSpace(unitType.String)
		if uType == "" {
			uType = "Bus"
		}

		mfgStr := strings.TrimSpace(mfr.String)
		if mfgStr == "" {
			if uType == "Bus" {
				mfgStr = "Blue Bird"
			} else if uType == "Van" {
				mfgStr = "Ford"
			} else {
				mfgStr = "Chevrolet"
			}
		}

		modelStr := strings.TrimSpace(model.String)
		if modelStr == "" {
			if uType == "Bus" {
				modelStr = "Vision / CE"
			} else if uType == "Van" {
				modelStr = "Transit-350"
			} else {
				modelStr = "Impala"
			}
		}

		fType := strings.TrimSpace(fuelType.String)
		if fType == "" {
			if uType == "Bus" {
				fType = "Diesel"
			} else {
				fType = "Gasoline"
			}
		}

		expiryStr := ""
		if licExpiry.Valid {
			expiryStr = licExpiry.Time.Format("2006-01-02")
		} else {
			expiryStr = "2028-08-31"
		}

		// Status & Yard assignment
		asg := assignments[vehicleID]
		statusStr := "Spare"
		assignedRouteID := ""
		assignedRouteNo := ""
		assignedRouteName := ""
		driverID := ""
		driverName := strings.TrimSpace(driverNameRow.String)
		driverPhone := ""
		yardName := "HQ-Central"

		if vehicleID%3 == 1 {
			yardName = "HQ-Central"
		} else if vehicleID%3 == 2 {
			yardName = "Yard-East"
		} else {
			yardName = "Yard-West"
		}

		if asg != nil {
			statusStr = "In Service"
			assignedRouteID = fmt.Sprintf("RT-%03d", asg.RouteID)
			assignedRouteNo = asg.RouteNo
			assignedRouteName = asg.RouteName
			if asg.EmpNumber != "" {
				driverID = fmt.Sprintf("EMP-%s", asg.EmpNumber)
			}
			driverName = asg.DriverName
			driverPhone = asg.DriverPhone
		}

		var empIDPtr *int
		if empID.Valid && empID.Int32 > 0 {
			v := int(empID.Int32)
			empIDPtr = &v
		}

		vObj := &models.Vehicle{
			ID:                docID,
			VehicleID:         vehicleID,
			UnitNumber:        strings.TrimSpace(unitNum.String),
			PlateNumber:       strings.TrimSpace(plateNum.String),
			Vin:               strings.TrimSpace(vin.String),
			Manufacturer:      mfgStr,
			Model:             modelStr,
			Year:              int(year.Int32),
			Color:             strings.TrimSpace(color.String),
			UnitType:          uType,
			SeatCap:           int(seatCap.Int32),
			WheelchairCap:     int(wcCap.Int32),
			FuelType:          fType,
			LicenseExpiry:     expiryStr,
			Active:            active,
			Status:            statusStr,
			YardName:          yardName,
			EmployeeID:        empIDPtr,
			DriverID:          driverID,
			DriverName:        driverName,
			DriverPhone:       driverPhone,
			AssignedRouteID:   assignedRouteID,
			AssignedRouteNo:   assignedRouteNo,
			AssignedRouteName: assignedRouteName,
			Notes:             strings.TrimSpace(notes.String),
			CreatedAt:         now,
			UpdatedAt:         now,
		}

		docRef := coll.Doc(docID)
		batch.Set(docRef, vObj)
		count++
	}

	if _, err := batch.Commit(ctx); err != nil {
		log.Fatalf("[FATAL] Batch commit to Firestore failed: %v", err)
	}

	fmt.Printf("\n[SUCCESS] Synchronized %d vehicles into collection 'vehicles'!\n", count)
	fmt.Printf("Time: %s\n", time.Now().Format(time.RFC3339))
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
