package archiver

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"cloud.google.com/go/bigquery"
	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"
)

type Archiver struct {
	fsClient  *firestore.Client
	bqClient  *bigquery.Client
	projectID string
	datasetID string
}

type ArchiveRow struct {
	ID           string    `bigquery:"id"`
	DispatchDate string    `bigquery:"dispatch_date"`
	Data         string    `bigquery:"data"`
	UpdatedAt    time.Time `bigquery:"updated_at"`
}

type LogTableConfig struct {
	Collection string
	DateField  string
}

// HighFrequencyLogConfigs represents operational and audit logs (7-day hot retention in Firestore, weekly sync to BigQuery, 2-year BQ TTL)
var HighFrequencyLogConfigs = []LogTableConfig{
	{Collection: "dispatch_change_logs", DateField: "dispatchDate"},
	{Collection: "route_change_logs", DateField: "timestamp"},
	{Collection: "entity_operation_logs", DateField: "timestamp"},
	{Collection: "payroll_operation_logs", DateField: "timestamp"},
	{Collection: "operational_safety_logs", DateField: "timestamp"},
	{Collection: "pretrip_inspections", DateField: "inspectionDate"},
}

// AnnualIncidentConfigs represents incident/safety records (~2000/year, retained per school year in Firestore)
var AnnualIncidentConfigs = []LogTableConfig{
	{Collection: "vehicle_defects", DateField: "defectDate"},
	{Collection: "student_incidents", DateField: "incidentDate"},
	{Collection: "hazard_reports", DateField: "hazardDate"},
}

func NewArchiver(fsClient *firestore.Client, bqClient *bigquery.Client, projectID, datasetID string) *Archiver {
	if datasetID == "" {
		datasetID = "firestore_export"
	}
	return &Archiver{
		fsClient:  fsClient,
		bqClient:  bqClient,
		projectID: projectID,
		datasetID: datasetID,
	}
}

// EnsureTables creates dataset and required tables if they don't exist
func (a *Archiver) EnsureTables(ctx context.Context) error {
	if a.bqClient == nil {
		return fmt.Errorf("bigquery client is nil")
	}

	ds := a.bqClient.Dataset(a.datasetID)
	if _, err := ds.Metadata(ctx); err != nil {
		log.Printf("[ARCHIVER] Creating BigQuery dataset: %s", a.datasetID)
		if createErr := ds.Create(ctx, &bigquery.DatasetMetadata{
			Location: "US",
		}); createErr != nil {
			return fmt.Errorf("failed to create dataset %s: %w", a.datasetID, createErr)
		}
	}

	schema := bigquery.Schema{
		{Name: "id", Type: bigquery.StringFieldType, Required: true},
		{Name: "dispatch_date", Type: bigquery.StringFieldType, Required: true},
		{Name: "data", Type: bigquery.StringFieldType, Required: true},
		{Name: "updated_at", Type: bigquery.TimestampFieldType, Required: true},
	}

	// 1. Business tables (dispatch_shifts, dispatch_payrolls, payroll_logs, time_off_requests, route_assessments, vehicle_signouts, expense_reimbursements)
	bizTables := []string{
		"dispatch_shifts",
		"dispatch_payrolls",
		"payroll_logs",
		"time_off_requests",
		"route_assessments",
		"vehicle_signouts",
		"expense_reimbursements",
	}
	for _, tblName := range bizTables {
		tbl := ds.Table(tblName)
		if _, err := tbl.Metadata(ctx); err != nil {
			log.Printf("[ARCHIVER] Creating BigQuery business table: %s.%s", a.datasetID, tblName)
			err := tbl.Create(ctx, &bigquery.TableMetadata{
				Schema: schema,
			})
			if err != nil {
				return fmt.Errorf("failed to create table %s: %w", tblName, err)
			}
		}
	}

	// 2. High-Frequency Log tables (2-year partition expiration) and Annual Incident tables
	allLogs := append(append([]LogTableConfig{}, HighFrequencyLogConfigs...), AnnualIncidentConfigs...)
	twoYears := 730 * 24 * time.Hour
	for _, cfg := range allLogs {
		tbl := ds.Table(cfg.Collection)
		if _, err := tbl.Metadata(ctx); err != nil {
			log.Printf("[ARCHIVER] Creating BigQuery log/incident table with 2-year TTL: %s.%s", a.datasetID, cfg.Collection)
			err := tbl.Create(ctx, &bigquery.TableMetadata{
				Schema: schema,
				TimePartitioning: &bigquery.TimePartitioning{
					Type:       bigquery.DayPartitioningType,
					Field:      "updated_at",
					Expiration: twoYears, // Automatically expires partitions older than 2 years
				},
			})
			if err != nil {
				return fmt.Errorf("failed to create log/incident table %s: %w", cfg.Collection, err)
			}
		}
	}

	return nil
}

// SyncWeeklyLogs syncs the 2 high-frequency operational logs for the past 7 days (called every Saturday)
func (a *Archiver) SyncWeeklyLogs(ctx context.Context) error {
	log.Printf("[ARCHIVER] Starting weekly sync for operational logs (dispatch_change_logs & pretrip_inspections, past 7 days)...")

	for dayOffset := 1; dayOffset <= 7; dayOffset++ {
		dateStr := time.Now().AddDate(0, 0, -dayOffset).Format("2006-01-02")
		for _, cfg := range HighFrequencyLogConfigs {
			if err := a.syncCollectionByDateField(ctx, cfg.Collection, cfg.DateField, dateStr); err != nil {
				log.Printf("[ARCHIVER] Warning: syncing %s for %s failed: %v", cfg.Collection, dateStr, err)
			}
		}
	}

	log.Println("[ARCHIVER] Weekly operational log sync completed successfully.")
	return nil
}

// CleanupLogsFirestore cleans up ONLY the high-frequency operational logs older than specified days (default 7)
// NOTE: Vehicle defects, student incidents and hazard reports are KEPT in Firestore for the entire school year.
func (a *Archiver) CleanupLogsFirestore(ctx context.Context, olderThanDays int) error {
	if olderThanDays <= 0 {
		olderThanDays = 7
	}
	cutoff := time.Now().AddDate(0, 0, -olderThanDays).Format("2006-01-02")
	log.Printf("[ARCHIVER] Starting cleanup of high-frequency operational logs older than %s (%d days)...", cutoff, olderThanDays)

	for _, cfg := range HighFrequencyLogConfigs {
		deletedCount := 0
		var iter *firestore.DocumentIterator
		if cfg.DateField == "timestamp" {
			iter = a.fsClient.Collection(cfg.Collection).Where("timestamp", "<", cutoff+"T00:00:00").Documents(ctx)
		} else {
			iter = a.fsClient.Collection(cfg.Collection).Where(cfg.DateField, "<", cutoff).Documents(ctx)
		}
		for {
			doc, err := iter.Next()
			if err == iterator.Done {
				break
			}
			if err != nil {
				iter.Stop()
				return err
			}
			_, _ = doc.Ref.Delete(ctx)
			deletedCount++
		}
		iter.Stop()
		log.Printf("[ARCHIVER] Cleaned up %d documents from Firestore %s", deletedCount, cfg.Collection)
	}
	return nil
}

// SyncAnnualIncidents syncs safety/incident records for an entire school year or historical range
func (a *Archiver) SyncAnnualIncidents(ctx context.Context, startDate, endDate string) error {
	log.Printf("[ARCHIVER] Syncing annual incidents (defects, student incidents, hazards) from %s to %s...", startDate, endDate)
	for _, cfg := range AnnualIncidentConfigs {
		iter := a.fsClient.Collection(cfg.Collection).Where(cfg.DateField, ">=", startDate).Where(cfg.DateField, "<=", endDate).Documents(ctx)
		var rows []*ArchiveRow
		now := time.Now()
		for {
			doc, err := iter.Next()
			if err == iterator.Done {
				break
			}
			if err != nil {
				iter.Stop()
				return err
			}
			dataBytes, _ := json.Marshal(doc.Data())
			dateVal := ""
			if d, ok := doc.Data()[cfg.DateField].(string); ok {
				dateVal = d
			}
			rows = append(rows, &ArchiveRow{
				ID:           doc.Ref.ID,
				DispatchDate: dateVal,
				Data:         string(dataBytes),
				UpdatedAt:    now,
			})
		}
		iter.Stop()

		if len(rows) > 0 {
			inserter := a.bqClient.Dataset(a.datasetID).Table(cfg.Collection).Inserter()
			if err := inserter.Put(ctx, rows); err != nil {
				log.Printf("[ARCHIVER] Warning: putting annual rows for %s: %v", cfg.Collection, err)
			} else {
				log.Printf("[ARCHIVER] Successfully archived %d annual records for %s to BigQuery", len(rows), cfg.Collection)
			}
		}
	}
	return nil
}

// SyncIncidentsOlderThan copies vehicle defects and student incidents older than olderThanDays (default 180) to BigQuery
// ArchiveIncidentsOlderThan syncs vehicle defects and student incidents older than olderThanDays (default 180) to BigQuery,
// and upon successful persistence, safely cleans them up from Firestore.
func (a *Archiver) ArchiveIncidentsOlderThan(ctx context.Context, olderThanDays int) (int, int, error) {
	if olderThanDays <= 0 {
		olderThanDays = 180
	}
	cutoff := time.Now().AddDate(0, 0, -olderThanDays).Format("2006-01-02")
	log.Printf("[ARCHIVER] Archiving (sync then cleanup) vehicle defects and student incidents older than %s (%d days)...", cutoff, olderThanDays)

	totalSynced := 0
	totalCleaned := 0

	// 1. Vehicle Defects
	defectsSynced, defectsCleaned, err := a.syncAndCleanupCollectionOlderThanDate(ctx, "vehicle_defects", []string{"reportDate", "defectDate"}, cutoff)
	if err != nil {
		log.Printf("[ARCHIVER] Warning: archiving vehicle_defects older than %s failed: %v", cutoff, err)
	} else {
		totalSynced += defectsSynced
		totalCleaned += defectsCleaned
	}

	// 2. Student Incidents
	incidentsSynced, incidentsCleaned, err := a.syncAndCleanupCollectionOlderThanDate(ctx, "student_incidents", []string{"incidentDate"}, cutoff)
	if err != nil {
		log.Printf("[ARCHIVER] Warning: archiving student_incidents older than %s failed: %v", cutoff, err)
	} else {
		totalSynced += incidentsSynced
		totalCleaned += incidentsCleaned
	}

	log.Printf("[ARCHIVER] Completed incident archive for records older than %d days: %d synced to BigQuery, %d cleaned up from Firestore.", olderThanDays, totalSynced, totalCleaned)
	return totalSynced, totalCleaned, nil
}

// SyncIncidentsOlderThan copies vehicle defects and student incidents older than olderThanDays (default 180) to BigQuery (read-only from Firestore).
func (a *Archiver) SyncIncidentsOlderThan(ctx context.Context, olderThanDays int) (int, error) {
	if olderThanDays <= 0 {
		olderThanDays = 180
	}
	cutoff := time.Now().AddDate(0, 0, -olderThanDays).Format("2006-01-02")
	log.Printf("[ARCHIVER] Copying vehicle defects and student incidents older than %s (%d days) to BigQuery...", cutoff, olderThanDays)

	totalSynced := 0

	// 1. Vehicle Defects
	defectCount, err := a.syncCollectionOlderThanDate(ctx, "vehicle_defects", []string{"reportDate", "defectDate"}, cutoff)
	if err != nil {
		log.Printf("[ARCHIVER] Warning: syncing vehicle_defects older than %s failed: %v", cutoff, err)
	} else {
		totalSynced += defectCount
	}

	// 2. Student Incidents
	incidentCount, err := a.syncCollectionOlderThanDate(ctx, "student_incidents", []string{"incidentDate"}, cutoff)
	if err != nil {
		log.Printf("[ARCHIVER] Warning: syncing student_incidents older than %s failed: %v", cutoff, err)
	} else {
		totalSynced += incidentCount
	}

	log.Printf("[ARCHIVER] Completed copying incidents older than %d days to BigQuery: %d records copied.", olderThanDays, totalSynced)
	return totalSynced, nil
}

// ArchiveHazardsOlderThan syncs hazard reports older than olderThanMonths (default 12) to BigQuery,
// and upon confirmed persistence, safely cleans them up from Firestore.
func (a *Archiver) ArchiveHazardsOlderThan(ctx context.Context, olderThanMonths int) (int, int, error) {
	if olderThanMonths <= 0 {
		olderThanMonths = 12
	}
	cutoff := time.Now().AddDate(0, -olderThanMonths, 0).Format("2006-01-02")
	log.Printf("[ARCHIVER] Archiving (sync then cleanup) hazard reports older than %s (%d months)...", cutoff, olderThanMonths)

	synced, cleaned, err := a.syncAndCleanupCollectionOlderThanDate(ctx, "hazard_reports", []string{"eventTime", "hazardDate", "createdAt"}, cutoff)
	if err != nil {
		log.Printf("[ARCHIVER] Warning: archiving hazard_reports older than %s failed: %v", cutoff, err)
		return 0, 0, err
	}

	log.Printf("[ARCHIVER] Completed hazard reports archive for records older than %d months: %d synced to BigQuery, %d cleaned up from Firestore.", olderThanMonths, synced, cleaned)
	return synced, cleaned, nil
}

// SyncHazardsOlderThan copies hazard reports older than olderThanMonths (default 12) to BigQuery (read-only from Firestore).
func (a *Archiver) SyncHazardsOlderThan(ctx context.Context, olderThanMonths int) (int, error) {
	if olderThanMonths <= 0 {
		olderThanMonths = 12
	}
	cutoff := time.Now().AddDate(0, -olderThanMonths, 0).Format("2006-01-02")
	log.Printf("[ARCHIVER] Copying hazard reports older than %s (%d months) to BigQuery...", cutoff, olderThanMonths)

	count, err := a.syncCollectionOlderThanDate(ctx, "hazard_reports", []string{"eventTime", "hazardDate", "createdAt"}, cutoff)
	if err != nil {
		log.Printf("[ARCHIVER] Warning: syncing hazard_reports older than %s failed: %v", cutoff, err)
		return 0, err
	}

	log.Printf("[ARCHIVER] Completed copying hazard reports older than %d months to BigQuery: %d records copied.", olderThanMonths, count)
	return count, nil
}

// ArchiveRouteAssessmentsOlderThan syncs route assessments older than olderThanMonths (default 12) to BigQuery,
// and upon confirmed persistence, safely cleans them up from Firestore.
func (a *Archiver) ArchiveRouteAssessmentsOlderThan(ctx context.Context, olderThanMonths int) (int, int, error) {
	if olderThanMonths <= 0 {
		olderThanMonths = 12
	}
	cutoff := time.Now().AddDate(0, -olderThanMonths, 0).Format("2006-01-02")
	log.Printf("[ARCHIVER] Archiving (sync then cleanup) route assessments older than %s (%d months)...", cutoff, olderThanMonths)

	synced, cleaned, err := a.syncAndCleanupCollectionOlderThanDate(ctx, "route_assessments", []string{"assessmentDate", "createdAt"}, cutoff)
	if err != nil {
		log.Printf("[ARCHIVER] Warning: archiving route_assessments older than %s failed: %v", cutoff, err)
		return 0, 0, err
	}

	log.Printf("[ARCHIVER] Completed route assessments archive for records older than %d months: %d synced to BigQuery, %d cleaned up from Firestore.", olderThanMonths, synced, cleaned)
	return synced, cleaned, nil
}

// SyncRouteAssessmentsOlderThan copies route assessments older than olderThanMonths (default 12) to BigQuery (read-only from Firestore).
func (a *Archiver) SyncRouteAssessmentsOlderThan(ctx context.Context, olderThanMonths int) (int, error) {
	if olderThanMonths <= 0 {
		olderThanMonths = 12
	}
	cutoff := time.Now().AddDate(0, -olderThanMonths, 0).Format("2006-01-02")
	log.Printf("[ARCHIVER] Copying route assessments older than %s (%d months) to BigQuery...", cutoff, olderThanMonths)

	count, err := a.syncCollectionOlderThanDate(ctx, "route_assessments", []string{"assessmentDate", "createdAt"}, cutoff)
	if err != nil {
		log.Printf("[ARCHIVER] Warning: syncing route_assessments older than %s failed: %v", cutoff, err)
		return 0, err
	}

	log.Printf("[ARCHIVER] Completed copying route assessments older than %d months to BigQuery: %d records copied.", olderThanMonths, count)
	return count, nil
}

// ArchiveVehicleSignoutsOlderThan syncs vehicle handovers / signouts older than olderThanMonths (default 12) to BigQuery,
// and upon confirmed persistence, safely cleans them up from Firestore.
func (a *Archiver) ArchiveVehicleSignoutsOlderThan(ctx context.Context, olderThanMonths int) (int, int, error) {
	if olderThanMonths <= 0 {
		olderThanMonths = 12
	}
	cutoff := time.Now().AddDate(0, -olderThanMonths, 0).Format("2006-01-02")
	log.Printf("[ARCHIVER] Archiving (sync then cleanup) vehicle handovers older than %s (%d months)...", cutoff, olderThanMonths)

	synced, cleaned, err := a.syncAndCleanupCollectionOlderThanDate(ctx, "vehicle_signouts", []string{"signDate", "driverSignDate", "createdAt"}, cutoff)
	if err != nil {
		log.Printf("[ARCHIVER] Warning: archiving vehicle_signouts older than %s failed: %v", cutoff, err)
		return 0, 0, err
	}

	log.Printf("[ARCHIVER] Completed vehicle handovers archive for records older than %d months: %d synced to BigQuery, %d cleaned up from Firestore.", olderThanMonths, synced, cleaned)
	return synced, cleaned, nil
}

// SyncVehicleSignoutsOlderThan copies vehicle handovers older than olderThanMonths (default 12) to BigQuery (read-only from Firestore).
func (a *Archiver) SyncVehicleSignoutsOlderThan(ctx context.Context, olderThanMonths int) (int, error) {
	if olderThanMonths <= 0 {
		olderThanMonths = 12
	}
	cutoff := time.Now().AddDate(0, -olderThanMonths, 0).Format("2006-01-02")
	log.Printf("[ARCHIVER] Copying vehicle handovers older than %s (%d months) to BigQuery...", cutoff, olderThanMonths)

	count, err := a.syncCollectionOlderThanDate(ctx, "vehicle_signouts", []string{"signDate", "driverSignDate", "createdAt"}, cutoff)
	if err != nil {
		log.Printf("[ARCHIVER] Warning: syncing vehicle_signouts older than %s failed: %v", cutoff, err)
		return 0, err
	}

	log.Printf("[ARCHIVER] Completed copying vehicle handovers older than %d months to BigQuery: %d records copied.", olderThanMonths, count)
	return count, nil
}

// ArchivePretripsOlderThan syncs pretrip inspections older than olderThanDays (default 14) to BigQuery,
// and upon verified persistence, safely cleans them up from Firestore.
func (a *Archiver) ArchivePretripsOlderThan(ctx context.Context, olderThanDays int) (int, int, error) {
	if olderThanDays <= 0 {
		olderThanDays = 14
	}
	cutoff := time.Now().AddDate(0, 0, -olderThanDays).Format("2006-01-02")
	log.Printf("[ARCHIVER] Archiving (sync then cleanup) pretrip inspections older than %s (%d days)...", cutoff, olderThanDays)

	synced, cleaned, err := a.syncAndCleanupCollectionOlderThanDate(ctx, "pretrip_inspections", []string{"inspectionDate", "createdAt"}, cutoff)
	if err != nil {
		log.Printf("[ARCHIVER] Warning: archiving pretrip_inspections older than %s failed: %v", cutoff, err)
		return 0, 0, err
	}

	log.Printf("[ARCHIVER] Completed pretrip inspections archive for records older than %d days: %d synced to BigQuery, %d cleaned up from Firestore.", olderThanDays, synced, cleaned)
	return synced, cleaned, nil
}

// SyncPretripsOlderThan copies pretrip inspections older than olderThanDays (default 14) to BigQuery (read-only from Firestore).
func (a *Archiver) SyncPretripsOlderThan(ctx context.Context, olderThanDays int) (int, error) {
	if olderThanDays <= 0 {
		olderThanDays = 14
	}
	cutoff := time.Now().AddDate(0, 0, -olderThanDays).Format("2006-01-02")
	log.Printf("[ARCHIVER] Copying pretrip inspections older than %s (%d days) to BigQuery...", cutoff, olderThanDays)

	count, err := a.syncCollectionOlderThanDate(ctx, "pretrip_inspections", []string{"inspectionDate", "createdAt"}, cutoff)
	if err != nil {
		log.Printf("[ARCHIVER] Warning: syncing pretrip_inspections older than %s failed: %v", cutoff, err)
		return 0, err
	}

	log.Printf("[ARCHIVER] Completed copying pretrip inspections older than %d days to BigQuery: %d records copied.", olderThanDays, count)
	return count, nil
}

// ArchiveExpensesOlderThan syncs expense reimbursement claims older than olderThanMonths (default 6 months) to BigQuery,
// and upon verified persistence, safely cleans them up from Firestore.
func (a *Archiver) ArchiveExpensesOlderThan(ctx context.Context, olderThanMonths int) (int, int, error) {
	if olderThanMonths <= 0 {
		olderThanMonths = 6
	}
	cutoff := time.Now().AddDate(0, -olderThanMonths, 0).Format("2006-01-02")
	log.Printf("[ARCHIVER] Archiving (sync then cleanup) expense claims older than %s (%d months)...", cutoff, olderThanMonths)

	synced, cleaned, err := a.syncAndCleanupCollectionOlderThanDate(ctx, "expense_reimbursements", []string{"claimDate", "createdAt"}, cutoff)
	if err != nil {
		log.Printf("[ARCHIVER] Warning: archiving expense_reimbursements older than %s failed: %v", cutoff, err)
		return 0, 0, err
	}

	log.Printf("[ARCHIVER] Completed expense claims archive for records older than %d months: %d synced to BigQuery, %d cleaned up from Firestore.", olderThanMonths, synced, cleaned)
	return synced, cleaned, nil
}

// SyncExpensesOlderThan copies expense reimbursement claims older than olderThanMonths (default 6 months) to BigQuery (read-only from Firestore).
func (a *Archiver) SyncExpensesOlderThan(ctx context.Context, olderThanMonths int) (int, error) {
	if olderThanMonths <= 0 {
		olderThanMonths = 6
	}
	cutoff := time.Now().AddDate(0, -olderThanMonths, 0).Format("2006-01-02")
	log.Printf("[ARCHIVER] Copying expense claims older than %s (%d months) to BigQuery...", cutoff, olderThanMonths)

	count, err := a.syncCollectionOlderThanDate(ctx, "expense_reimbursements", []string{"claimDate", "createdAt"}, cutoff)
	if err != nil {
		log.Printf("[ARCHIVER] Warning: syncing expense_reimbursements older than %s failed: %v", cutoff, err)
		return 0, err
	}

	log.Printf("[ARCHIVER] Completed copying expense claims older than %d months to BigQuery: %d records copied.", olderThanMonths, count)
	return count, nil
}

// syncAndCleanupCollectionOlderThanDate queries Firestore, persists to BigQuery, and ONLY on 100% success removes the documents from Firestore.
func (a *Archiver) syncAndCleanupCollectionOlderThanDate(ctx context.Context, collName string, dateFields []string, cutoff string) (int, int, error) {
	var rows []*ArchiveRow
	var ids []string
	now := time.Now()
	seen := make(map[string]bool)
	cutoffTime, errTime := time.Parse("2006-01-02", cutoff)

	for _, df := range dateFields {
		var iter *firestore.DocumentIterator
		if (df == "createdAt" || df == "timestamp" || df == "assessmentDate") && errTime == nil {
			iter = a.fsClient.Collection(collName).Where(df, "<", cutoffTime).Documents(ctx)
		} else {
			iter = a.fsClient.Collection(collName).Where(df, "<", cutoff).Documents(ctx)
		}
		for {
			doc, err := iter.Next()
			if err == iterator.Done {
				break
			}
			if err != nil {
				iter.Stop()
				return 0, 0, err
			}

			if seen[doc.Ref.ID] {
				continue
			}
			seen[doc.Ref.ID] = true

			data := doc.Data()
			dataBytes, err := json.Marshal(data)
			if err != nil {
				continue
			}

			dateVal := ""
			for _, f := range dateFields {
				if d, ok := data[f].(string); ok && d != "" {
					if len(d) >= 10 {
						dateVal = d[:10]
					} else {
						dateVal = d
					}
					break
				} else if t, ok := data[f].(time.Time); ok && !t.IsZero() {
					dateVal = t.Format("2006-01-02")
					break
				}
			}
			if dateVal == "" {
				dateVal = cutoff
			}

			rows = append(rows, &ArchiveRow{
				ID:           doc.Ref.ID,
				DispatchDate: dateVal,
				Data:         string(dataBytes),
				UpdatedAt:    now,
			})
			ids = append(ids, doc.Ref.ID)
		}
		iter.Stop()
	}

	if len(rows) == 0 {
		return 0, 0, nil
	}

	// 1. Delete existing records in BigQuery for idempotency
	delChunkSize := 400
	for i := 0; i < len(ids); i += delChunkSize {
		end := i + delChunkSize
		if end > len(ids) {
			end = len(ids)
		}
		chunkIDs := ids[i:end]
		delSQL := fmt.Sprintf("DELETE FROM `%s.%s.%s` WHERE id IN UNNEST(@ids)", a.projectID, a.datasetID, collName)
		q := a.bqClient.Query(delSQL)
		q.Parameters = []bigquery.QueryParameter{
			{Name: "ids", Value: chunkIDs},
		}
		job, err := q.Run(ctx)
		if err == nil {
			_, _ = job.Wait(ctx)
		}
	}

	// 2. Batch insert into BigQuery (chunks of 500)
	inserter := a.bqClient.Dataset(a.datasetID).Table(collName).Inserter()
	chunkSize := 500
	for i := 0; i < len(rows); i += chunkSize {
		end := i + chunkSize
		if end > len(rows) {
			end = len(rows)
		}
		if err := inserter.Put(ctx, rows[i:end]); err != nil {
			return 0, 0, fmt.Errorf("failed to insert rows into BigQuery %s: %w", collName, err)
		}
	}

	log.Printf("[ARCHIVER] BigQuery insertion confirmed: %d records in table %s. Proceeding to cleanup from Firestore...", len(rows), collName)

	// 3. Safe Cleanup from Firestore: only delete IDs that successfully made it into BigQuery
	deletedCount := 0
	delBatchSize := 400
	for i := 0; i < len(ids); i += delBatchSize {
		end := i + delBatchSize
		if end > len(ids) {
			end = len(ids)
		}
		batch := a.fsClient.Batch()
		for _, id := range ids[i:end] {
			batch.Delete(a.fsClient.Collection(collName).Doc(id))
		}
		if _, err := batch.Commit(ctx); err == nil {
			deletedCount += (end - i)
		} else {
			log.Printf("[ARCHIVER] Warning: batch delete from Firestore %s failed: %v", collName, err)
		}
	}

	log.Printf("[ARCHIVER] Successfully archived %d and cleaned up %d records from Firestore %s (older than %s)", len(rows), deletedCount, collName, cutoff)
	return len(rows), deletedCount, nil
}

func (a *Archiver) syncCollectionOlderThanDate(ctx context.Context, collName string, dateFields []string, cutoff string) (int, error) {
	var rows []*ArchiveRow
	var ids []string
	now := time.Now()
	seen := make(map[string]bool)
	cutoffTime, errTime := time.Parse("2006-01-02", cutoff)

	for _, df := range dateFields {
		var iter *firestore.DocumentIterator
		if (df == "createdAt" || df == "timestamp" || df == "assessmentDate") && errTime == nil {
			iter = a.fsClient.Collection(collName).Where(df, "<", cutoffTime).Documents(ctx)
		} else {
			iter = a.fsClient.Collection(collName).Where(df, "<", cutoff).Documents(ctx)
		}
		for {
			doc, err := iter.Next()
			if err == iterator.Done {
				break
			}
			if err != nil {
				iter.Stop()
				return 0, err
			}

			if seen[doc.Ref.ID] {
				continue
			}
			seen[doc.Ref.ID] = true

			data := doc.Data()
			dataBytes, err := json.Marshal(data)
			if err != nil {
				continue
			}

			dateVal := ""
			for _, f := range dateFields {
				if d, ok := data[f].(string); ok && d != "" {
					if len(d) >= 10 {
						dateVal = d[:10]
					} else {
						dateVal = d
					}
					break
				} else if t, ok := data[f].(time.Time); ok && !t.IsZero() {
					dateVal = t.Format("2006-01-02")
					break
				}
			}
			if dateVal == "" {
				dateVal = cutoff
			}

			rows = append(rows, &ArchiveRow{
				ID:           doc.Ref.ID,
				DispatchDate: dateVal,
				Data:         string(dataBytes),
				UpdatedAt:    now,
			})
			ids = append(ids, doc.Ref.ID)
		}
		iter.Stop()
	}

	if len(rows) == 0 {
		return 0, nil
	}

	// Delete existing records in BigQuery for idempotency
	delChunkSize := 400
	for i := 0; i < len(ids); i += delChunkSize {
		end := i + delChunkSize
		if end > len(ids) {
			end = len(ids)
		}
		chunkIDs := ids[i:end]
		delSQL := fmt.Sprintf("DELETE FROM `%s.%s.%s` WHERE id IN UNNEST(@ids)", a.projectID, a.datasetID, collName)
		q := a.bqClient.Query(delSQL)
		q.Parameters = []bigquery.QueryParameter{
			{Name: "ids", Value: chunkIDs},
		}
		job, err := q.Run(ctx)
		if err == nil {
			_, _ = job.Wait(ctx)
		}
	}

	// Batch insert into BigQuery (chunks of 500)
	inserter := a.bqClient.Dataset(a.datasetID).Table(collName).Inserter()
	chunkSize := 500
	for i := 0; i < len(rows); i += chunkSize {
		end := i + chunkSize
		if end > len(rows) {
			end = len(rows)
		}
		if err := inserter.Put(ctx, rows[i:end]); err != nil {
			return 0, fmt.Errorf("failed to insert rows into BigQuery %s: %w", collName, err)
		}
	}

	log.Printf("[ARCHIVER] Successfully copied %d records from Firestore %s to BigQuery (older than %s)", len(rows), collName, cutoff)
	return len(rows), nil
}

// SyncTimeOff syncs time-off requests older than olderThanDays (default 30) past endDate to BigQuery table time_off_requests
func (a *Archiver) SyncTimeOff(ctx context.Context, olderThanDays int) (int, error) {
	if olderThanDays <= 0 {
		olderThanDays = 30
	}
	cutoff := time.Now().AddDate(0, 0, -olderThanDays).Format("2006-01-02")
	log.Printf("[ARCHIVER] Syncing time-off requests with endDate < %s (%d days past endDate) to BigQuery...", cutoff, olderThanDays)

	iter := a.fsClient.Collection("time_off_requests").Where("endDate", "<", cutoff).Documents(ctx)
	defer iter.Stop()

	now := time.Now()
	var rows []*ArchiveRow
	var ids []string

	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return 0, fmt.Errorf("reading time_off_requests: %w", err)
		}

		data := doc.Data()
		dataBytes, err := json.Marshal(data)
		if err != nil {
			continue
		}

		dateVal := ""
		if ed, ok := data["endDate"].(string); ok && ed != "" {
			dateVal = ed
		} else if sd, ok := data["startDate"].(string); ok && sd != "" {
			dateVal = sd
		} else {
			dateVal = now.Format("2006-01-02")
		}

		rows = append(rows, &ArchiveRow{
			ID:           doc.Ref.ID,
			DispatchDate: dateVal,
			Data:         string(dataBytes),
			UpdatedAt:    now,
		})
		ids = append(ids, doc.Ref.ID)
	}

	if len(rows) == 0 {
		log.Printf("[ARCHIVER] No time-off requests found with endDate < %s to sync.", cutoff)
		return 0, nil
	}

	// Delete existing records in BigQuery for idempotency
	delChunkSize := 400
	for i := 0; i < len(ids); i += delChunkSize {
		end := i + delChunkSize
		if end > len(ids) {
			end = len(ids)
		}
		chunkIDs := ids[i:end]
		delSQL := fmt.Sprintf("DELETE FROM `%s.%s.time_off_requests` WHERE id IN UNNEST(@ids)", a.projectID, a.datasetID)
		q := a.bqClient.Query(delSQL)
		q.Parameters = []bigquery.QueryParameter{
			{Name: "ids", Value: chunkIDs},
		}
		job, err := q.Run(ctx)
		if err == nil {
			_, _ = job.Wait(ctx)
		}
	}

	// Batch insert into BigQuery (chunks of 500)
	inserter := a.bqClient.Dataset(a.datasetID).Table("time_off_requests").Inserter()
	chunkSize := 500
	for i := 0; i < len(rows); i += chunkSize {
		end := i + chunkSize
		if end > len(rows) {
			end = len(rows)
		}
		if err := inserter.Put(ctx, rows[i:end]); err != nil {
			return 0, fmt.Errorf("failed to insert time_off_requests into BigQuery: %w", err)
		}
	}

	log.Printf("[ARCHIVER] Successfully archived %d time-off requests to BigQuery table time_off_requests", len(rows))
	return len(rows), nil
}

// CleanupTimeOffFirestore deletes time-off requests from Firestore whose endDate is older than olderThanDays (min 30 days)
func (a *Archiver) CleanupTimeOffFirestore(ctx context.Context, olderThanDays int) (int, error) {
	if olderThanDays < 30 {
		olderThanDays = 30 // Safeguard: never delete time off within 30 days of endDate
	}
	cutoff := time.Now().AddDate(0, 0, -olderThanDays).Format("2006-01-02")
	log.Printf("[ARCHIVER] Starting cleanup of Firestore time-off requests with endDate < %s (%d days past endDate)...", cutoff, olderThanDays)

	iter := a.fsClient.Collection("time_off_requests").Where("endDate", "<", cutoff).Documents(ctx)
	defer iter.Stop()

	deletedCount := 0
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return deletedCount, err
		}
		if _, err := doc.Ref.Delete(ctx); err == nil {
			deletedCount++
		}
	}

	log.Printf("[ARCHIVER] Cleaned up %d time-off requests from Firestore time_off_requests", deletedCount)
	return deletedCount, nil
}

// ArchiveTimeOff syncs time-off requests older than 30 days to BigQuery and cleans them up from Firestore
func (a *Archiver) ArchiveTimeOff(ctx context.Context, olderThanDays int) (int, int, error) {
	synced, err := a.SyncTimeOff(ctx, olderThanDays)
	if err != nil {
		return 0, 0, fmt.Errorf("sync time-off failed: %w", err)
	}
	deleted, err := a.CleanupTimeOffFirestore(ctx, olderThanDays)
	if err != nil {
		return synced, 0, fmt.Errorf("cleanup time-off failed: %w", err)
	}
	return synced, deleted, nil
}

// SyncDate syncs dispatch_shifts, dispatch_payrolls, and payroll_logs for a specific date
func (a *Archiver) SyncDate(ctx context.Context, date string) error {
	log.Printf("[ARCHIVER] Syncing data for date %s to BigQuery...", date)

	if err := a.syncCollectionDate(ctx, "dispatch_shifts", date); err != nil {
		return fmt.Errorf("failed to sync dispatch_shifts for %s: %w", date, err)
	}

	if err := a.syncCollectionDate(ctx, "dispatch_payrolls", date); err != nil {
		return fmt.Errorf("failed to sync dispatch_payrolls for %s: %w", date, err)
	}

	if err := a.syncCollectionDate(ctx, "payroll_logs", date); err != nil {
		return fmt.Errorf("failed to sync payroll_logs for %s: %w", date, err)
	}

	// Also sync operational logs for this specific date
	for _, cfg := range HighFrequencyLogConfigs {
		if err := a.syncCollectionByDateField(ctx, cfg.Collection, cfg.DateField, date); err != nil {
			log.Printf("[ARCHIVER] Warning: sync %s for date %s failed: %v", cfg.Collection, date, err)
		}
	}

	log.Printf("[ARCHIVER] Successfully synced %s to BigQuery", date)
	return nil
}

// SyncRolling syncs the past N days (e.g. 35 days) for shifts/payrolls to catch recent modifications
func (a *Archiver) SyncRolling(ctx context.Context, days int) error {
	if days <= 0 {
		days = 35
	}
	log.Printf("[ARCHIVER] Starting rolling sync for the last %d days...", days)

	for i := 1; i <= days; i++ {
		dateStr := time.Now().AddDate(0, 0, -i).Format("2006-01-02")
		if err := a.SyncDate(ctx, dateStr); err != nil {
			log.Printf("[ARCHIVER] Warning: sync failed for date %s: %v", dateStr, err)
		}
	}
	return nil
}

// syncCollectionDate extracts from Firestore and upserts to BigQuery for a given date
func (a *Archiver) syncCollectionDate(ctx context.Context, collName, date string) error {
	return a.syncCollectionByDateField(ctx, collName, "dispatchDate", date)
}

func (a *Archiver) syncCollectionByDateField(ctx context.Context, collName, dateField, date string) error {
	var iter *firestore.DocumentIterator
	if dateField == "timestamp" {
		iter = a.fsClient.Collection(collName).
			Where("timestamp", ">=", date+"T00:00:00").
			Where("timestamp", "<=", date+"T23:59:59.999Z").
			Documents(ctx)
	} else {
		iter = a.fsClient.Collection(collName).Where(dateField, "==", date).Documents(ctx)
	}
	defer iter.Stop()

	now := time.Now()
	var rows []*ArchiveRow

	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return err
		}

		dataBytes, err := json.Marshal(doc.Data())
		if err != nil {
			continue
		}

		rows = append(rows, &ArchiveRow{
			ID:           doc.Ref.ID,
			DispatchDate: date,
			Data:         string(dataBytes),
			UpdatedAt:    now,
		})
	}

	if len(rows) == 0 {
		return nil
	}

	// Delete existing records for this date in BigQuery to maintain idempotence
	delSQL := fmt.Sprintf("DELETE FROM `%s.%s.%s` WHERE dispatch_date = @date", a.projectID, a.datasetID, collName)
	q := a.bqClient.Query(delSQL)
	q.Parameters = []bigquery.QueryParameter{
		{Name: "date", Value: date},
	}
	job, err := q.Run(ctx)
	if err == nil {
		_, _ = job.Wait(ctx)
	}

	// Batch insert new records (chunks of 500)
	inserter := a.bqClient.Dataset(a.datasetID).Table(collName).Inserter()
	chunkSize := 500
	for i := 0; i < len(rows); i += chunkSize {
		end := i + chunkSize
		if end > len(rows) {
			end = len(rows)
		}
		if err := inserter.Put(ctx, rows[i:end]); err != nil {
			return fmt.Errorf("failed to insert rows into %s: %w", collName, err)
		}
	}

	log.Printf("[ARCHIVER] Inserted %d rows into BigQuery %s for date %s", len(rows), collName, date)
	return nil
}

// CleanupFirestore removes documents older than specified days (e.g. 60 or 90 days)
func (a *Archiver) CleanupFirestore(ctx context.Context, olderThanDays int) error {
	if olderThanDays < 60 {
		olderThanDays = 60 // Safe guard
	}
	cutoff := time.Now().AddDate(0, 0, -olderThanDays).Format("2006-01-02")
	log.Printf("[ARCHIVER] Starting cleanup of Firestore documents older than %s (%d days)...", cutoff, olderThanDays)

	collections := []string{"dispatch_shifts", "dispatch_payrolls", "payroll_logs"}
	for _, coll := range collections {
		deletedCount := 0
		iter := a.fsClient.Collection(coll).Where("dispatchDate", "<", cutoff).Documents(ctx)
		for {
			doc, err := iter.Next()
			if err == iterator.Done {
				break
			}
			if err != nil {
				iter.Stop()
				return err
			}
			_, _ = doc.Ref.Delete(ctx)
			deletedCount++
		}
		iter.Stop()
		log.Printf("[ARCHIVER] Cleaned up %d documents from Firestore %s", deletedCount, coll)
	}
	return nil
}
