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
	annualFrom := flag.String("annual-from", "", "Archive school year incidents start date (YYYY-MM-DD)")
	annualTo := flag.String("annual-to", "", "Archive school year incidents end date (YYYY-MM-DD)")
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

	if *annualFrom != "" && *annualTo != "" {
		log.Printf("[ARCHIVE-CLI] Syncing annual incidents from %s to %s...", *annualFrom, *annualTo)
		if err := arc.SyncAnnualIncidents(ctx, *annualFrom, *annualTo); err != nil {
			log.Fatalf("[ARCHIVE-CLI] SyncAnnualIncidents failed: %v", err)
		}
	}

	log.Println("[ARCHIVE-CLI] Done!")
}
