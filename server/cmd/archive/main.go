package main

import (
	"context"
	"flag"
	"log"
	"time"

	"cloud.google.com/go/bigquery"
	firebase "firebase.google.com/go/v4"
	"google.golang.org/api/option"

	"dispatch-server/internal/archiver"
	"dispatch-server/internal/config"
)

func main() {
	initTables := flag.Bool("init", false, "Initialize BigQuery dataset and tables")
	targetDate := flag.String("date", "", "Sync specific date (YYYY-MM-DD)")
	rollingDays := flag.Int("rolling", 0, "Sync last N days (e.g. 35)")
	cleanupDays := flag.Int("cleanup", 0, "Delete Firestore shifts/payrolls older than N days (min 60)")
	syncLogs := flag.Bool("sync-logs", false, "Sync high-frequency operational logs (change_logs, pretrip) for past 7 days (weekly job)")
	cleanupLogsDays := flag.Int("cleanup-logs", 0, "Delete Firestore operational logs older than N days (default 7)")
	syncAll := flag.Bool("sync-all", false, "Unified sync: rolling shifts/payrolls + weekly operational logs + time-off archive + 180-day incidents")
	annualFrom := flag.String("annual-from", "", "Archive school year incidents start date (YYYY-MM-DD)")
	annualTo := flag.String("annual-to", "", "Archive school year incidents end date (YYYY-MM-DD)")
	syncIncidents := flag.Bool("sync-incidents", false, "Copy vehicle defects and student incidents older than N days (default 180) to BigQuery (read-only)")
	archiveIncidents := flag.Bool("archive-incidents", false, "Both sync and cleanup vehicle defects & student incidents older than N days (default 180)")
	incidentsDays := flag.Int("incidents-days", 180, "Days threshold for defects & incidents archive (default 180)")
	syncHazards := flag.Bool("sync-hazards", false, "Copy hazard reports older than N months to BigQuery (read-only)")
	archiveHazards := flag.Bool("archive-hazards", false, "Both sync and cleanup hazard reports older than N months (default 12)")
	hazardMonths := flag.Int("hazard-months", 12, "Months threshold for hazard reports archive (default 12)")
	syncAssessments := flag.Bool("sync-assessments", false, "Copy route assessments older than N months to BigQuery (read-only)")
	archiveAssessments := flag.Bool("archive-assessments", false, "Both sync and cleanup route assessments older than N months (default 12)")
	assessmentMonths := flag.Int("assessment-months", 12, "Months threshold for route assessments archive (default 12)")
	syncHandovers := flag.Bool("sync-handovers", false, "Copy vehicle handovers / signouts older than N months to BigQuery (read-only)")
	archiveHandovers := flag.Bool("archive-handovers", false, "Both sync and cleanup vehicle handovers older than N months (default 12)")
	handoverMonths := flag.Int("handover-months", 12, "Months threshold for vehicle handovers archive (default 12)")
	syncPretrips := flag.Bool("sync-pretrips", false, "Copy pretrip inspections older than N days to BigQuery (read-only)")
	archivePretrips := flag.Bool("archive-pretrips", false, "Both sync and cleanup pretrip inspections older than N days (default 14)")
	pretripDays := flag.Int("pretrip-days", 14, "Days threshold for pretrip inspections archive (default 14)")
	syncExpenses := flag.Bool("sync-expenses", false, "Copy expense claims older than N months to BigQuery (read-only)")
	archiveExpenses := flag.Bool("archive-expenses", false, "Both sync and cleanup expense claims older than N months (default 6)")
	expenseMonths := flag.Int("expense-months", 6, "Months threshold for expense claims archive (default 6)")
	syncTimeOff := flag.Bool("sync-timeoff", false, "Sync time-off requests older than 30 days past endDate to BigQuery")
	cleanupTimeOff := flag.Bool("cleanup-timeoff", false, "Delete Firestore time-off requests older than 30 days past endDate")
	archiveTimeOff := flag.Bool("archive-timeoff", false, "Both sync and cleanup time-off requests older than 30 days past endDate")
	timeOffDays := flag.Int("timeoff-days", 30, "Days threshold for time-off archive (min 30, default 30)")
	flag.Parse()

	cfg := config.LoadConfig()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()

	log.Printf("[ARCHIVE-CLI] Starting archiver CLI for project: %s", cfg.ProjectID)

	saPath := config.ResolveCredentialsPath()
	var opt option.ClientOption
	if saPath != "" {
		opt = option.WithCredentialsFile(saPath)
	}

	var app *firebase.App
	var err error
	if opt != nil {
		app, err = firebase.NewApp(ctx, &firebase.Config{ProjectID: cfg.ProjectID}, opt)
	} else {
		app, err = firebase.NewApp(ctx, &firebase.Config{ProjectID: cfg.ProjectID})
	}
	if err != nil {
		log.Fatalf("[ARCHIVE-CLI] Failed to initialize Firebase: %v", err)
	}

	fsClient, err := app.Firestore(ctx)
	if err != nil {
		log.Fatalf("[ARCHIVE-CLI] Failed to initialize Firestore: %v", err)
	}
	defer fsClient.Close()

	var bqClient *bigquery.Client
	if opt != nil {
		bqClient, err = bigquery.NewClient(ctx, cfg.ProjectID, opt)
	} else {
		bqClient, err = bigquery.NewClient(ctx, cfg.ProjectID)
	}
	if err != nil {
		log.Fatalf("[ARCHIVE-CLI] Failed to initialize BigQuery: %v", err)
	}
	defer bqClient.Close()

	arc := archiver.NewArchiver(fsClient, bqClient, cfg.ProjectID, cfg.BigQueryDataset)

	if *initTables {
		log.Println("[ARCHIVE-CLI] Initializing BigQuery dataset and tables...")
		if err := arc.EnsureTables(ctx); err != nil {
			log.Fatalf("[ARCHIVE-CLI] Failed to ensure tables: %v", err)
		}
		log.Println("[ARCHIVE-CLI] Tables ready.")
	}

	if *targetDate != "" {
		log.Printf("[ARCHIVE-CLI] Syncing date %s...", *targetDate)
		if err := arc.SyncDate(ctx, *targetDate); err != nil {
			log.Fatalf("[ARCHIVE-CLI] Sync failed: %v", err)
		}
	}

	if *rollingDays > 0 {
		log.Printf("[ARCHIVE-CLI] Syncing rolling %d days...", *rollingDays)
		if err := arc.SyncRolling(ctx, *rollingDays); err != nil {
			log.Fatalf("[ARCHIVE-CLI] Rolling sync failed: %v", err)
		}
	}

	if *cleanupDays > 0 {
		log.Printf("[ARCHIVE-CLI] Cleaning up Firestore older than %d days...", *cleanupDays)
		if err := arc.CleanupFirestore(ctx, *cleanupDays); err != nil {
			log.Fatalf("[ARCHIVE-CLI] Cleanup failed: %v", err)
		}
	}

	if *syncLogs {
		log.Println("[ARCHIVE-CLI] Syncing operational logs (change_logs, pretrip) to BigQuery...")
		if err := arc.SyncWeeklyLogs(ctx); err != nil {
			log.Fatalf("[ARCHIVE-CLI] SyncWeeklyLogs failed: %v", err)
		}
	}

	if *cleanupLogsDays > 0 {
		log.Printf("[ARCHIVE-CLI] Cleaning up Firestore operational logs older than %d days...", *cleanupLogsDays)
		if err := arc.CleanupLogsFirestore(ctx, *cleanupLogsDays); err != nil {
			log.Fatalf("[ARCHIVE-CLI] CleanupLogsFirestore failed: %v", err)
		}
	}

	if *syncAll {
		days := 35
		if *rollingDays > 0 {
			days = *rollingDays
		}
		log.Printf("[ARCHIVE-CLI] Running unified sync-all (rolling %d days + weekly logs + time-off archive)...", days)
		if err := arc.SyncRolling(ctx, days); err != nil {
			log.Printf("[ARCHIVE-CLI] SyncRolling error: %v", err)
		}
		if err := arc.SyncWeeklyLogs(ctx); err != nil {
			log.Printf("[ARCHIVE-CLI] SyncWeeklyLogs error: %v", err)
		}
		if synced, deleted, err := arc.ArchiveTimeOff(ctx, 30); err != nil {
			log.Printf("[ARCHIVE-CLI] ArchiveTimeOff error: %v", err)
		} else {
			log.Printf("[ARCHIVE-CLI] ArchiveTimeOff completed: %d synced, %d cleaned up.", synced, deleted)
		}
		if synced, deleted, err := arc.ArchiveIncidentsOlderThan(ctx, 180); err != nil {
			log.Printf("[ARCHIVE-CLI] ArchiveIncidentsOlderThan error: %v", err)
		} else {
			log.Printf("[ARCHIVE-CLI] ArchiveIncidentsOlderThan completed: %d synced to BigQuery, %d cleaned up from Firestore.", synced, deleted)
		}
		if synced, deleted, err := arc.ArchiveHazardsOlderThan(ctx, 12); err != nil {
			log.Printf("[ARCHIVE-CLI] ArchiveHazardsOlderThan error: %v", err)
		} else {
			log.Printf("[ARCHIVE-CLI] ArchiveHazardsOlderThan completed: %d hazard reports synced to BigQuery, %d cleaned up from Firestore.", synced, deleted)
		}
		if synced, deleted, err := arc.ArchiveRouteAssessmentsOlderThan(ctx, 12); err != nil {
			log.Printf("[ARCHIVE-CLI] ArchiveRouteAssessmentsOlderThan error: %v", err)
		} else {
			log.Printf("[ARCHIVE-CLI] ArchiveRouteAssessmentsOlderThan completed: %d route assessments synced to BigQuery, %d cleaned up from Firestore.", synced, deleted)
		}
		if synced, deleted, err := arc.ArchiveVehicleSignoutsOlderThan(ctx, 12); err != nil {
			log.Printf("[ARCHIVE-CLI] ArchiveVehicleSignoutsOlderThan error: %v", err)
		} else {
			log.Printf("[ARCHIVE-CLI] ArchiveVehicleSignoutsOlderThan completed: %d vehicle handovers synced to BigQuery, %d cleaned up from Firestore.", synced, deleted)
		}
		if synced, deleted, err := arc.ArchivePretripsOlderThan(ctx, 14); err != nil {
			log.Printf("[ARCHIVE-CLI] ArchivePretripsOlderThan error: %v", err)
		} else {
			log.Printf("[ARCHIVE-CLI] ArchivePretripsOlderThan completed: %d pretrip inspections synced to BigQuery, %d cleaned up from Firestore.", synced, deleted)
		}
		if synced, deleted, err := arc.ArchiveExpensesOlderThan(ctx, 6); err != nil {
			log.Printf("[ARCHIVE-CLI] ArchiveExpensesOlderThan error: %v", err)
		} else {
			log.Printf("[ARCHIVE-CLI] ArchiveExpensesOlderThan completed: %d expense claims synced to BigQuery, %d cleaned up from Firestore.", synced, deleted)
		}
		log.Println("[ARCHIVE-CLI] Unified sync-all finished.")
	}

	if *syncIncidents {
		log.Printf("[ARCHIVE-CLI] Copying vehicle defects and student incidents older than %d days to BigQuery...", *incidentsDays)
		if count, err := arc.SyncIncidentsOlderThan(ctx, *incidentsDays); err != nil {
			log.Fatalf("[ARCHIVE-CLI] SyncIncidentsOlderThan failed: %v", err)
		} else {
			log.Printf("[ARCHIVE-CLI] Successfully copied %d records to BigQuery.", count)
		}
	}

	if *archiveIncidents {
		log.Printf("[ARCHIVE-CLI] Archiving (sync then cleanup) vehicle defects and student incidents older than %d days...", *incidentsDays)
		if synced, deleted, err := arc.ArchiveIncidentsOlderThan(ctx, *incidentsDays); err != nil {
			log.Fatalf("[ARCHIVE-CLI] ArchiveIncidentsOlderThan failed: %v", err)
		} else {
			log.Printf("[ARCHIVE-CLI] Successfully archived %d and cleaned up %d records from Firestore.", synced, deleted)
		}
	}

	if *syncHazards {
		log.Printf("[ARCHIVE-CLI] Copying hazard reports older than %d months to BigQuery...", *hazardMonths)
		if count, err := arc.SyncHazardsOlderThan(ctx, *hazardMonths); err != nil {
			log.Fatalf("[ARCHIVE-CLI] SyncHazardsOlderThan failed: %v", err)
		} else {
			log.Printf("[ARCHIVE-CLI] Successfully copied %d hazard reports to BigQuery.", count)
		}
	}

	if *archiveHazards {
		log.Printf("[ARCHIVE-CLI] Archiving (sync then cleanup) hazard reports older than %d months...", *hazardMonths)
		if synced, deleted, err := arc.ArchiveHazardsOlderThan(ctx, *hazardMonths); err != nil {
			log.Fatalf("[ARCHIVE-CLI] ArchiveHazardsOlderThan failed: %v", err)
		} else {
			log.Printf("[ARCHIVE-CLI] Successfully archived %d and cleaned up %d hazard reports from Firestore.", synced, deleted)
		}
	}

	if *syncAssessments {
		log.Printf("[ARCHIVE-CLI] Copying route assessments older than %d months to BigQuery...", *assessmentMonths)
		if count, err := arc.SyncRouteAssessmentsOlderThan(ctx, *assessmentMonths); err != nil {
			log.Fatalf("[ARCHIVE-CLI] SyncRouteAssessmentsOlderThan failed: %v", err)
		} else {
			log.Printf("[ARCHIVE-CLI] Successfully copied %d route assessments to BigQuery.", count)
		}
	}

	if *archiveAssessments {
		log.Printf("[ARCHIVE-CLI] Archiving (sync then cleanup) route assessments older than %d months...", *assessmentMonths)
		if synced, deleted, err := arc.ArchiveRouteAssessmentsOlderThan(ctx, *assessmentMonths); err != nil {
			log.Fatalf("[ARCHIVE-CLI] ArchiveRouteAssessmentsOlderThan failed: %v", err)
		} else {
			log.Printf("[ARCHIVE-CLI] Successfully archived %d and cleaned up %d route assessments from Firestore.", synced, deleted)
		}
	}

	if *syncHandovers {
		log.Printf("[ARCHIVE-CLI] Copying vehicle handovers older than %d months to BigQuery...", *handoverMonths)
		if count, err := arc.SyncVehicleSignoutsOlderThan(ctx, *handoverMonths); err != nil {
			log.Fatalf("[ARCHIVE-CLI] SyncVehicleSignoutsOlderThan failed: %v", err)
		} else {
			log.Printf("[ARCHIVE-CLI] Successfully copied %d vehicle handovers to BigQuery.", count)
		}
	}

	if *archiveHandovers {
		log.Printf("[ARCHIVE-CLI] Archiving (sync then cleanup) vehicle handovers older than %d months...", *handoverMonths)
		if synced, deleted, err := arc.ArchiveVehicleSignoutsOlderThan(ctx, *handoverMonths); err != nil {
			log.Fatalf("[ARCHIVE-CLI] ArchiveVehicleSignoutsOlderThan failed: %v", err)
		} else {
			log.Printf("[ARCHIVE-CLI] Successfully archived %d and cleaned up %d vehicle handovers from Firestore.", synced, deleted)
		}
	}

	if *syncPretrips {
		log.Printf("[ARCHIVE-CLI] Copying pretrip inspections older than %d days to BigQuery...", *pretripDays)
		if count, err := arc.SyncPretripsOlderThan(ctx, *pretripDays); err != nil {
			log.Fatalf("[ARCHIVE-CLI] SyncPretripsOlderThan failed: %v", err)
		} else {
			log.Printf("[ARCHIVE-CLI] Successfully copied %d pretrip inspections to BigQuery.", count)
		}
	}

	if *archivePretrips {
		log.Printf("[ARCHIVE-CLI] Archiving (sync then cleanup) pretrip inspections older than %d days...", *pretripDays)
		if synced, deleted, err := arc.ArchivePretripsOlderThan(ctx, *pretripDays); err != nil {
			log.Fatalf("[ARCHIVE-CLI] ArchivePretripsOlderThan failed: %v", err)
		} else {
			log.Printf("[ARCHIVE-CLI] Successfully archived %d and cleaned up %d pretrip inspections from Firestore.", synced, deleted)
		}
	}

	if *syncExpenses {
		log.Printf("[ARCHIVE-CLI] Copying expense claims older than %d months to BigQuery...", *expenseMonths)
		if count, err := arc.SyncExpensesOlderThan(ctx, *expenseMonths); err != nil {
			log.Fatalf("[ARCHIVE-CLI] SyncExpensesOlderThan failed: %v", err)
		} else {
			log.Printf("[ARCHIVE-CLI] Successfully copied %d expense claims to BigQuery.", count)
		}
	}

	if *archiveExpenses {
		log.Printf("[ARCHIVE-CLI] Archiving (sync then cleanup) expense claims older than %d months...", *expenseMonths)
		if synced, deleted, err := arc.ArchiveExpensesOlderThan(ctx, *expenseMonths); err != nil {
			log.Fatalf("[ARCHIVE-CLI] ArchiveExpensesOlderThan failed: %v", err)
		} else {
			log.Printf("[ARCHIVE-CLI] Successfully archived %d and cleaned up %d expense claims from Firestore.", synced, deleted)
		}
	}

	if *annualFrom != "" && *annualTo != "" {
		log.Printf("[ARCHIVE-CLI] Syncing annual incidents from %s to %s...", *annualFrom, *annualTo)
		if err := arc.SyncAnnualIncidents(ctx, *annualFrom, *annualTo); err != nil {
			log.Fatalf("[ARCHIVE-CLI] SyncAnnualIncidents failed: %v", err)
		}
	}

	if *syncTimeOff {
		log.Printf("[ARCHIVE-CLI] Syncing time-off requests older than %d days past endDate to BigQuery...", *timeOffDays)
		if count, err := arc.SyncTimeOff(ctx, *timeOffDays); err != nil {
			log.Fatalf("[ARCHIVE-CLI] SyncTimeOff failed: %v", err)
		} else {
			log.Printf("[ARCHIVE-CLI] Successfully synced %d time-off requests to BigQuery.", count)
		}
	}

	if *cleanupTimeOff {
		log.Printf("[ARCHIVE-CLI] Cleaning up Firestore time-off requests older than %d days past endDate...", *timeOffDays)
		if count, err := arc.CleanupTimeOffFirestore(ctx, *timeOffDays); err != nil {
			log.Fatalf("[ARCHIVE-CLI] CleanupTimeOffFirestore failed: %v", err)
		} else {
			log.Printf("[ARCHIVE-CLI] Successfully cleaned up %d time-off requests from Firestore.", count)
		}
	}

	if *archiveTimeOff {
		log.Printf("[ARCHIVE-CLI] Running full archive (sync + cleanup) for time-off requests older than %d days past endDate...", *timeOffDays)
		if synced, deleted, err := arc.ArchiveTimeOff(ctx, *timeOffDays); err != nil {
			log.Fatalf("[ARCHIVE-CLI] ArchiveTimeOff failed: %v", err)
		} else {
			log.Printf("[ARCHIVE-CLI] Time-off archive complete: %d synced to BigQuery, %d cleaned up from Firestore.", synced, deleted)
		}
	}

	log.Println("[ARCHIVE-CLI] Done!")
}
