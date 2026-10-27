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
	syncAll := flag.Bool("sync-all", false, "Unified sync: rolling shifts/payrolls + weekly operational logs + time-off archive")
	annualFrom := flag.String("annual-from", "", "Archive school year incidents start date (YYYY-MM-DD)")
	annualTo := flag.String("annual-to", "", "Archive school year incidents end date (YYYY-MM-DD)")
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
		log.Println("[ARCHIVE-CLI] Unified sync-all finished.")
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
