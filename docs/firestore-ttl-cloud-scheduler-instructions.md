# Firestore TTL & Cloud Scheduler Operations Guide
### Guide de Configuration Firestore TTL & Cloud Scheduler
### Firestore TTL 与 Cloud Scheduler 运维配置指南

<p align="center">
  <strong><a href="#english">English</a></strong> |
  <strong><a href="#français">Français</a></strong> |
  <strong><a href="#简体中文">简体中文</a></strong>
</p>

---

<a name="english"></a>
## English: Firestore TTL & Cloud Scheduler Archiving Guide

### 1. Architectural Overview: Tiered Hot / Cold Storage

To minimize cloud operational expenses while maintaining fast mobile and web responsiveness, the platform utilizes a **Tiered Storage Architecture**:

- **Hot Layer (Cloud Firestore)**: Serves active operational datasets for drivers, dispatchers, and parents (real-time listeners via `onSnapshot`).
- **Cold Layer (Google Cloud BigQuery)**: Stores historical records, audit logs, and compliance documents for statutory reporting with near-zero idle storage cost.

| Data Category | Target Collections / Tables | Hot Retention (Firestore) | Archive Frequency | Cold Retention (BigQuery) |
| :--- | :--- | :--- | :--- | :--- |
| **Operational & Shifts** | `dispatch_shifts`, `dispatch_payrolls`, `payroll_logs` | 60–90 days | Weekly rolling (35 days) | Permanent / Configurable |
| **Audit & Stream Logs** | `dispatch_change_logs`, `route_change_logs`, `entity_operation_logs`, `payroll_operation_logs`, `operational_safety_logs` | 7–14 days | Weekly (every Saturday) | **2 Years** (730-day automatic partition expiration) |
| **Pre-Trip Inspections** | `pretrip_inspections` | 14 days | Weekly archive via `sync-all` (14-day sync then cleanup) | **2 Years** (730-day automatic partition expiration) |
| **Expense Claims & Receipts** | `expense_reimbursements` | 6 months (180 days) | Weekly archive via `sync-all` (sync then cleanup) | Permanent |
| **Employee Time-Off** | `time_off_requests` | 30 days past `endDate` | Weekly via unified sync | Permanent |
| **Vehicle Defects & Incidents** | `vehicle_defects`, `student_incidents` | 180 days | Weekly archive via `sync-all` (sync then cleanup) | Permanent |
| **Hazard & Safety Concerns** | `hazard_reports` | 12 months (365 days) | Weekly archive via `sync-all` (sync then cleanup) | Permanent |
| **Route Safety Assessments** | `route_assessments` | 12 months (365 days) | Weekly archive via `sync-all` (sync then cleanup) | Permanent |
| **Vehicle Handovers / Sign-Outs** | `vehicle_signouts` | 12 months (365 days) | Weekly archive via `sync-all` (sync then cleanup) | Permanent |
| **Annual School-Year Review** | End-of-year audit & compliance check | Full School Year | End of school year (`sync-annual`) | Permanent |

---

### 2. Firestore Time-to-Live (TTL) Configuration

Firestore TTL policies run directly on Google Cloud infrastructure to automatically delete expired documents asynchronously at **zero additional read/delete billing charge**.

> [!NOTE]
> TTL policies are managed through the **Google Cloud Console (GCP)** or the `gcloud` CLI, rather than the basic Firebase Console web interface.

#### Option A: Google Cloud Console (Web UI)
1. Open the [Google Cloud Firestore TTL Console](https://console.cloud.google.com/firestore/ttl?project=schoolbusdispatchapp) (select your GCP Project: `schoolbusdispatchapp`).
2. Alternatively, in [Google Cloud Console](https://console.cloud.google.com/): Navigate to **Databases** ➔ **Firestore** ➔ Click **Time-to-live (TTL)** on the left sidebar.
3. Click **Create Policy**.
4. Set the **Collection group** (e.g. `dispatch_change_logs` or `login_logs`).
5. Set the **Timestamp field name** (e.g., `expireAt`).
6. Click **Create**.

> [!IMPORTANT]
> **TTL Field Semantics**: Firestore TTL expects a document timestamp that specifies when the document **should expire in the future** (e.g. `now + 14 days`). Do not set historical event timestamps (like `createdAt` or `timestamp`) directly as the TTL policy without understanding that any existing documents will be purged immediately.

#### Option B: Google Cloud SDK (`gcloud` CLI)
```bash
gcloud firestore fields ttls update expireAt \
    --collection-group=dispatch_change_logs \
    --project=schoolbusdispatchapp
```

---

### 3. Automated Cloud Scheduler Setup (`sync-all`)

To save recurring Cloud Scheduler invocation costs, all recurring archive operations are consolidated into a **single unified endpoint**: `POST /api/admin/archive/sync-all`.

In a single execution, `sync-all` runs:
1. **Shifts & Payrolls**: 35-day rolling sync to BigQuery (`dispatch_shifts`, `dispatch_payrolls`, `payroll_logs`).
2. **Weekly Audit Logs**: Syncs operational logs for the past 7 days to BigQuery with automatic 2-year table partition expiration.
3. **Time-Off Requests**: Automatically detects time-off requests where **`endDate` is older than 30 days**, syncs them to BigQuery table `time_off_requests`, and removes them from Firestore to keep the database lean.
4. **Defects & Student Incidents (180+ Days Sync then Cleanup)**: Automatically scans `vehicle_defects` and `student_incidents` older than 180 days, syncs them to BigQuery tables, and **upon confirmed insertion safely cleans them up from Firestore** to optimize storage.
5. **Hazard Reports (12-Month Sync then Cleanup)**: Automatically scans `hazard_reports` older than 12 months (evaluating `eventTime`, `hazardDate`, and `createdAt`), syncs them to BigQuery, and upon verified persistence safely cleans them up from Firestore.
6. **Route Assessments & Vehicle Handovers (12-Month Sync then Cleanup)**: Automatically archives `route_assessments` and `vehicle_signouts` older than 12 months to BigQuery and safely purges them from Firestore upon successful write.
7. **Pre-Trip Inspections (14-Day Sync then Cleanup)**: Automatically scans `pretrip_inspections` older than 14 days, syncs them to BigQuery table `pretrip_inspections` (with 2-year table partition expiration), and safely removes them from Firestore upon verified persistence.
8. **Expense Claims (6-Month Sync then Cleanup)**: Automatically scans `expense_reimbursements` older than 6 months (180 days based on `claimDate` and `createdAt`), syncs them to BigQuery table `expense_reimbursements`, and safely purges them from Firestore upon verified persistence.

#### Setting up the Cloud Scheduler Job in GCP Console:
1. Open the [Cloud Scheduler Console](https://console.cloud.google.com/cloudscheduler?project=schoolbusdispatchapp).
2. Click **Create Job**.
3. Fill in the job configuration:
   - **Name**: `weekly-unified-archive`
   - **Region**: `us-central1` (or your Cloud Run region)
   - **Frequency**: `0 2 * * 6` (Runs weekly every Saturday at 2:00 AM)
   - **Timezone**: Choose your operational timezone (e.g. `America/Toronto` or `UTC`)
4. Configure Execution Target:
   - **Target type**: `HTTP`
   - **URL**: `https://<YOUR-API-HOST>/api/admin/archive/sync-all?days=35`
   - **HTTP method**: `POST`
   - **HTTP Headers**:
     - `X-Admin-Secret`: `DispatchArchive2026!Secure` *(or your custom `ADMIN_API_SECRET`)*
     - `Content-Type`: `application/json`
5. Click **Create**.

#### Alternative: Create via `gcloud` CLI:
```bash
gcloud scheduler jobs create http weekly-unified-archive \
    --schedule="0 2 * * 6" \
    --time-zone="America/Toronto" \
    --uri="https://<YOUR-API-HOST>/api/admin/archive/sync-all?days=35" \
    --http-method=POST \
    --headers="X-Admin-Secret=DispatchArchive2026!Secure,Content-Type=application/json" \
    --project=schoolbusdispatchapp
```

---

### 4. Transparent Query Fallback

The backend Go API Server implements transparent **Dual-Engine Routing**:
- When querying `ListShifts`, `ListChangeLogs`, `ListTimeOffRequests`, `ListDefectReports`, `ListStudentIncidents`, `ListHazardReports`, `ListRouteAssessments`, `ListVehicleSignouts`, `ListPreTripInspections`, or `ListExpenseClaims` (as well as single-item lookups via `GetDefectReportByID`, `GetStudentIncidentByID`, `GetHazardReportByID`, `GetRouteAssessmentByID`, `GetVehicleSignoutByID`, and `GetExpenseClaimByID`):
  1. The server queries hot documents currently present in Firestore.
  2. For historical lists and single item lookups, the repository automatically merges or falls back to BigQuery cold storage.
  3. Dispatchers and drivers view complete historical records seamlessly without noticing data has transitioned from Firestore to BigQuery.

---

### 5. Manual Testing & CLI Commands

#### Trigger via `curl`:
```bash
# 1. Trigger the unified weekly archive (shifts, logs, 14-day pre-trips, 6-month expenses, time-off, 180-day defects/incidents, and 12-month hazards/assessments/handovers)
curl -X POST "https://<YOUR-API-HOST>/api/admin/archive/sync-all?days=35" \
     -H "X-Admin-Secret: DispatchArchive2026!Secure"

# 2. Trigger annual school year incident archiving
curl -X POST "https://<YOUR-API-HOST>/api/admin/archive/sync-annual?from=2025-09-01&to=2026-06-30" \
     -H "X-Admin-Secret: DispatchArchive2026!Secure"
```

#### Run CLI Tool (`server/cmd/archive`):
```bash
cd server

# Initialize BigQuery dataset and all tables
go run ./cmd/archive -init

# Run unified archive locally (shifts, logs, 14-day pretrips, 6-month expenses, time-off, incidents, hazards, assessments & handovers)
go run ./cmd/archive -sync-all

# Or run pretrip inspections archive only (sync and cleanup, default 14 days)
go run ./cmd/archive -archive-pretrips -pretrip-days=14

# Or run expense claims archive only (sync and cleanup, default 6 months)
go run ./cmd/archive -archive-expenses -expense-months=6

# Or run route assessments archive only (sync and cleanup, default 12 months)
go run ./cmd/archive -archive-assessments -assessment-months=12

# Or run vehicle handovers archive only (sync and cleanup, default 12 months)
go run ./cmd/archive -archive-handovers -handover-months=12

# Or run hazard reports archive only (sync and cleanup, default 12 months)
go run ./cmd/archive -archive-hazards -hazard-months=12

# Or run incident archive only (sync and cleanup, default 180 days)
go run ./cmd/archive -archive-incidents -incidents-days=180
```

---

<a name="français"></a>
## Français: Guide d'Archivage Firestore TTL & Cloud Scheduler

### 1. Vue d'Ensemble de l'Architecture : Stockage Hiérarchisé Chaud / Froid

Pour minimiser les coûts d'infrastructure infonuagique tout en garantissant des temps de réponse rapides sur le Web et mobile, la plateforme applique une **architecture de stockage multiniveau** :

- **Niveau Chaud (Cloud Firestore)** : Données actives d'exploitation pour les chauffeurs, répartiteurs et parents (mise à jour en temps réel via `onSnapshot`).
- **Niveau Froid (Google Cloud BigQuery)** : Archivage permanent à très faible coût des historiques, pistes d'audit et documents de conformité réglementaire.

| Catégorie de Données | Collections / Tables Cibles | Rétention Chaude (Firestore) | Fréquence d'Archivage | Rétention Froide (BigQuery) |
| :--- | :--- | :--- | :--- | :--- |
| **Services & Paie** | `dispatch_shifts`, `dispatch_payrolls`, `payroll_logs` | 60 à 90 jours | Glissement hebdomadaire (35 j) | Permanente / Configurable |
| **Journaux d'Audit & Flux** | `dispatch_change_logs`, `route_change_logs`, `entity_operation_logs`, `payroll_operation_logs`, `operational_safety_logs` | 7 à 14 jours | Hebdomadaire (samedi) | **2 ans** (Expiration automatique par partitionnement sur 730 jours) |
| **Inspections Pré-Départ** | `pretrip_inspections` | 14 jours | Archivage hebdomadaire via `sync-all` (sauvegarde puis nettoyage après 14j) | **2 ans** (Expiration 730 jours) |
| **Notes de Frais & Dépenses** | `expense_reimbursements` | 6 mois (180 jours) | Archivage hebdomadaire via `sync-all` (sauvegarde puis nettoyage après 6 mois) | Permanente |
| **Demandes de Congé** | `time_off_requests` | 30 jours après `endDate` | Hebdomadaire via `sync-all` | Permanente |
| **Vehicle Defects & Incidents** | `vehicle_defects`, `student_incidents` | 180 jours | Archivage hebdomadaire via `sync-all` (sauvegarde puis nettoyage) | Permanente |
| **Signalements de Dangers** | `hazard_reports` | 12 mois (365 j) | Archivage hebdomadaire via `sync-all` (sauvegarde puis nettoyage) | Permanente |
| **Évaluations des Circuits** | `route_assessments` | 12 mois (365 j) | Archivage hebdomadaire via `sync-all` (sauvegarde puis nettoyage) | Permanente |
| **Remises de Véhicules** | `vehicle_signouts` | 12 mois (365 j) | Archivage hebdomadaire via `sync-all` (sauvegarde puis nettoyage) | Permanente |
| **Revue Annuelle Scolaire** | Audit et conformité fin d'année | Toute l'année scolaire | Fin de l'année scolaire (`sync-annual`) | Permanente |

---

### 2. Configuration du TTL (Time-to-Live) Firestore

La règle TTL de Firestore s'exécute directement sur l'infrastructure Google Cloud pour supprimer de manière asynchrone les documents expirés **sans aucun frais de lecture ni de suppression supplémentaire**.

> [!NOTE]
> Les règles TTL sont administrées dans la **console Google Cloud (GCP)** ou via la ligne de commande `gcloud`, et non dans l'interface de base de la console Firebase.

#### Option A : Console Google Cloud (Interface Graphique)
1. Ouvrez la [Console TTL Google Cloud Firestore](https://console.cloud.google.com/firestore/ttl?project=schoolbusdispatchapp) (sélectionnez le projet GCP : `schoolbusdispatchapp`).
2. Ou naviguez dans [Google Cloud Console](https://console.cloud.google.com/) ➔ **Bases de données** ➔ **Firestore** ➔ Cliquez sur **Durée de vie (TTL)** dans le menu latéral.
3. Cliquez sur **Créer une règle**.
4. Indiquez le **Groupe de collections** (ex. `dispatch_change_logs` ou `login_logs`).
5. Renseignez le nom du **Champ d'horodatage** (ex. `expireAt`).
6. Cliquez sur **Créer**.

> [!IMPORTANT]
> **Sémantique du champ TTL** : Firestore attend une date d'horodatage correspondant à l'**échéance future de destruction** du document (ex. `maintenant + 14 jours`). Ne configurez pas directement la date de création de l'événement (`createdAt` ou `timestamp`) sans comprendre que tous les documents déjà existants seront immédiatement purgés.

#### Option B : Ligne de Commande SDK Google Cloud (`gcloud`)
```bash
gcloud firestore fields ttls update expireAt \
    --collection-group=dispatch_change_logs \
    --project=schoolbusdispatchapp
```

---

### 3. Automatisation avec Google Cloud Scheduler (`sync-all`)

Afin d'éviter de multiplier les tâches planifiées payantes, l'ensemble des tâches récurrentes d'archivage est regroupé dans un **point d'entrée unique** : `POST /api/admin/archive/sync-all`.

En une seule exécution, `sync-all` prend en charge :
1. **Services et Paie** : Synchronisation glissante des 35 derniers jours vers BigQuery.
2. **Journaux d'Audit Hebdomadaires** : Transfert des 7 derniers jours vers BigQuery avec TTL automatique de 2 ans.
3. **Demandes de Congé (Time-Off)** : Détection automatique des congés dont la date de fin (**`endDate`**) est passée depuis plus de 30 jours, archivage dans la table BigQuery `time_off_requests` et suppression sécurisée dans Firestore.
4. **Anomalies et Incidents Élèves (Archivage +180 jours)** : Détection automatique des anomalies et incidents scolaires datant de plus de 180 jours, synchronisation vers BigQuery et, **après confirmation du succès, nettoyage sécurisé dans Firestore** pour libérer de l'espace.
5. **Signalements de Dangers / Risques (Archivage +12 mois)** : Détection automatique des rapports de danger datant de plus de 12 mois, synchronisation vers BigQuery et suppression sécurisée dans Firestore après validation de la persistance.
6. **Évaluations d'itinéraires & Remises de véhicules (Archivage +12 mois)** : Détection et transfert des fiches `route_assessments` et `vehicle_signouts` de plus de 12 mois vers BigQuery avec purge sécurisée dans Firestore.
7. **Inspections pré-départ (+14 jours)** : Synchronisation automatique des fiches d'inspection `pretrip_inspections` de plus de 14 jours vers BigQuery et suppression sécurisée dans Firestore.
8. **Remboursements de frais (+6 mois)** : Synchronisation automatique des fiches de frais `expense_reimbursements` datant de plus de 6 mois vers BigQuery et suppression sécurisée dans Firestore après validation de la persistance.

#### Création de la tâche dans la Console Cloud Scheduler :
1. Ouvrez la [Console Cloud Scheduler](https://console.cloud.google.com/cloudscheduler?project=schoolbusdispatchapp).
2. Cliquez sur **Créer un travail**.
3. Paramètres de planification :
   - **Nom** : `weekly-unified-archive`
   - **Région** : `us-central1` (ou la région de votre service Cloud Run)
   - **Fréquence** : `0 2 * * 6` (Tous les samedis à 02h00 du matin)
   - **Fuseau horaire** : `America/Toronto` (ou votre fuseau local)
4. Configuration de la cible :
   - **Type de cible** : `HTTP`
   - **URL** : `https://<VOTRE-HOTE-API>/api/admin/archive/sync-all?days=35`
   - **Méthode HTTP** : `POST`
   - **En-têtes HTTP** :
     - `X-Admin-Secret` : `DispatchArchive2026!Secure` *(ou votre clé secrète configurée)*
     - `Content-Type` : `application/json`
5. Cliquez sur **Créer**.

#### Alternative via `gcloud` :
```bash
gcloud scheduler jobs create http weekly-unified-archive \
    --schedule="0 2 * * 6" \
    --time-zone="America/Toronto" \
    --uri="https://<VOTRE-HOTE-API>/api/admin/archive/sync-all?days=35" \
    --http-method=POST \
    --headers="X-Admin-Secret=DispatchArchive2026!Secure,Content-Type=application/json" \
    --project=schoolbusdispatchapp
```

---

### 4. Routage Transparent & Repli BigQuery (Fallback)

Le serveur API Go intègre un **mécanisme de routage transparent** :
- Lors d'une requête sur `ListShifts`, `ListChangeLogs`, `ListTimeOffRequests`, `ListDefectReports`, `ListStudentIncidents`, `ListHazardReports`, `ListRouteAssessments`, `ListVehicleSignouts`, `ListPreTripInspections` ou `ListExpenseClaims` (ou par identifiant avec `GetDefectReportByID`, `GetStudentIncidentByID`, `GetHazardReportByID`, `GetRouteAssessmentByID`, `GetVehicleSignoutByID` et `GetExpenseClaimByID`) :
  1. Le serveur consulte les documents actifs de Firestore.
  2. Le dépôt fusionne automatiquement ou bascule sur les archives froides de BigQuery pour les enregistrements anciens.
  3. Les utilisateurs finaux ont un accès complet et transparent à l'historique sans modification côté client.

---

### 5. Tests Manuels & Commandes CLI

```bash
# Déclencher l'archivage unifié complet via curl (services, logs, 14j inspections, 6 mois dépenses, congés, incidents +180j, dangers, évaluations et remises +12 mois)
curl -X POST "https://<VOTRE-HOTE-API>/api/admin/archive/sync-all?days=35" \
     -H "X-Admin-Secret: DispatchArchive2026!Secure"

# Déclencher l'archivage annuel des incidents scolaires
curl -X POST "https://<VOTRE-HOTE-API>/api/admin/archive/sync-annual?from=2025-09-01&to=2026-06-30" \
     -H "X-Admin-Secret: DispatchArchive2026!Secure"

# Exécution locale avec server/cmd/archive
go run ./cmd/archive -sync-all
go run ./cmd/archive -archive-pretrips -pretrip-days=14
go run ./cmd/archive -archive-expenses -expense-months=6
go run ./cmd/archive -archive-assessments -assessment-months=12
go run ./cmd/archive -archive-handovers -handover-months=12
go run ./cmd/archive -archive-hazards -hazard-months=12
go run ./cmd/archive -archive-incidents -incidents-days=180
```

---

<a name="简体中文"></a>
## 简体中文: Firestore TTL 与 Cloud Scheduler 自动化归档配置指南

### 1. 架构总览：冷热数据分层设计

为兼顾移动端/网页端的极速响应并最大限度降低云存储与数据库读写费用，系统采用了标准的**冷热分层架构**：

- **热数据层 (Cloud Firestore)**：承载当前正在执行与近期高频读写的业务数据，支持 Web 端与 Flutter 移动端的毫秒级 `onSnapshot` 实时推送。
- **冷数据层 (Google Cloud BigQuery)**：承载审计流水日志、历史已结单据和历史请假记录，以超低闲置成本支撑长期合规留存与数据分析。

| 数据类别 | 涉及集合 / 数据表 | Firestore 热保留期 | 归档周期 | BigQuery 冷存储保留期 |
| :--- | :--- | :--- | :--- | :--- |
| **日常调度与薪资** | `dispatch_shifts`, `dispatch_payrolls`, `payroll_logs` | 60～90 天 | 每周滚动覆盖 35 天 | 长期归档保留 |
| **系统审计流水日志** | `dispatch_change_logs`, `route_change_logs`, `entity_operation_logs`, `payroll_operation_logs`, `operational_safety_logs` | 7～14 天 | 每周六执行 | **2 年**（730 天按分区时间自动过期销毁） |
| **出车前检查** | `pretrip_inspections` | 14 天 | 每周随 `sync-all` 归档（超 14 天备份后清理） | **2 年**（730 天按分区时间自动过期销毁） |
| **费用报销与支出凭证** | `expense_reimbursements` | 6 个月（180 天） | 每周随 `sync-all` 归档（超 6 个月备份后清理） | 长期归档保留 |
| **员工请假申请** | `time_off_requests` | 超过 `endDate` 30 天 | 每周随 `sync-all` 执行 | 长期归档保留 |
| **车辆缺陷与学生事故** | `vehicle_defects`, `student_incidents` | 180 天 | 每周随 `sync-all` 归档（备份后清理） | 长期归档保留 |
| **道路与安全隐患报告** | `hazard_reports` | 12 个月（365 天） | 每周随 `sync-all` 归档（备份后清理） | 长期归档保留 |
| **线路安全评估** | `route_assessments` | 12 个月（365 天） | 每周随 `sync-all` 归档（备份后清理） | 长期归档保留 |
| **车辆交接与领还车单** | `vehicle_signouts` | 12 个月（365 天） | 每周随 `sync-all` 归档（备份后清理） | 长期归档保留 |
| **学年末合规归档** | 全学年合规审计与清档 | 常驻整个学年 | 学年结束归档 (`sync-annual`) | 长期归档保留 |

---

### 2. Firestore TTL (Time-to-Live / 存活时间) 配置说明

Firestore TTL 策略由 Google Cloud 底层自动执行，会在文档过期后于后台异步删除，**完全免费且不消耗读写/删除配额**。

> [!NOTE]
> Firestore 的 TTL 规则配置入口位于 **Google Cloud Console (GCP)** 或通过 `gcloud` 命令行配置，而非基础版 Firebase 控制台。

#### 方式一：通过 Google Cloud 控制台直达（图形化界面）
1. 打开 [Google Cloud Firestore TTL 控制台](https://console.cloud.google.com/firestore/ttl?project=schoolbusdispatchapp)（选择您的 GCP 项目：`schoolbusdispatchapp`）。
2. 或在 [Google Cloud 控制台](https://console.cloud.google.com/) 中：导航至 **Databases** ➔ **Firestore** ➔ 点击左侧菜单的 **存活时间 (TTL)**。
3. 点击 **创建策略 (Create Policy)**。
4. 填写 **集合组 (Collection group)**（例如 `dispatch_change_logs` 或 `login_logs`）。
5. 填写作为过期依据的 **时间戳字段名 (Timestamp field)**（例如 `expireAt`）。
6. 点击 **创建**。

> [!IMPORTANT]
> **TTL 时间戳字段定义规范**：Firestore TTL 依赖文档内的一个 Timestamp 字段，该字段必须表示**未来的销毁时间点**（如写入时预设为 `当前时间 + 14天`）。切勿将发生时间（如 `createdAt` 或 `timestamp`）直接配为 TTL，否则会导致历史已有数据被立即认定为超期删除。

#### 方式二：通过 `gcloud` 命令行配置
```bash
gcloud firestore fields ttls update expireAt \
    --collection-group=dispatch_change_logs \
    --project=schoolbusdispatchapp
```

---

### 3. Cloud Scheduler 唯一聚合归档任务 (`sync-all`)

为了节省 Cloud Scheduler 的定时任务配置配额与 Cloud Run 调用费用，系统将原本分散的定时任务全部收敛到了**唯一定时任务接口**：`POST /api/admin/archive/sync-all`。

调用一次 `sync-all`，系统将在后台自动按序完成：
1. **调度与薪资滚动同步**：滚动归档过去 35 天的 `dispatch_shifts`、`dispatch_payrolls` 和 `payroll_logs` 到 BigQuery。
2. **高频流水日志周同步**：同步过去 7 天的 5 大系统审计日志到 BigQuery（自动开启 2 年分区 TTL）。
3. **请假记录归档与清理**：自动筛选结束日期（`endDate`）**超过 30 天**的请假单，同步到 BigQuery `time_off_requests` 表，并自动从 Firestore 中删除释放容量。
4. **超 180 天单据归档与清理（车辆缺陷与学生事故）**：自动筛选报告时间/事故发生时间超过 180 天的 `vehicle_defects` 和 `student_incidents` 同步到 BigQuery，并在**确认入库成功后**安全从 Firestore 中批量清理释放容量（严格遵循先入库后清理原则，绝不丢失数据）。
5. **超 12 个月安全隐患归档与清理（hazard_reports）**：自动筛选发生时间/报告时间超过 12 个月的道路隐患单（`hazard_reports`），同步到 BigQuery 数据表并在确认成功后从 Firestore 批量清除。
6. **超 12 个月路线评估与车辆交接归档与清理（route_assessments / vehicle_signouts）**：自动筛选创建/发生时间超过 12 个月的路线评估单与车队领还车交接单，同步到 BigQuery 并在确认写入无误后安全从 Firestore 中批量清理，释放热库容量。
7. **超 14 天出车前检查归档与清理（pretrip_inspections）**：自动筛选检查日期/创建时间超过 14 天的车辆出车检查记录，同步至 BigQuery 数据表（带 2 年分区 TTL），并在确认写入成功后安全从 Firestore 中批量清理释放空间。
8. **超 6 个月费用报销单归档与清理（expense_reimbursements）**：自动筛选发生日期/创建时间超过 6 个月（180 天）的司机报销申请与支出凭据，同步至 BigQuery 数据表，并在确认写入成功后安全从 Firestore 中批量清理释放空间。

#### 在 GCP 控制台配置 Cloud Scheduler 定时任务：
1. 打开 [Cloud Scheduler 控制台](https://console.cloud.google.com/cloudscheduler?project=schoolbusdispatchapp)。
2. 点击 **创建作业 (Create Job)**。
3. 作业基本配置：
   - **名称**：`weekly-unified-archive`
   - **区域**：`us-central1`（或您部署 Cloud Run 的区域）
   - **频率 (Cron)**：`0 2 * * 6`（每周六凌晨 02:00 自动触发）
   - **时区**：选择您业务所在地时区（如 `America/Toronto`）
4. 配置执行目标：
   - **目标类型**：`HTTP`
   - **网址 (URL)**：`https://<YOUR-API-HOST>/api/admin/archive/sync-all?days=35`
   - **HTTP 方法**：`POST`
   - **HTTP 标头 (Headers)**：
     - `X-Admin-Secret`: `DispatchArchive2026!Secure` *(或您在环境变量中自定义的 `ADMIN_API_SECRET`)*
     - `Content-Type`: `application/json`
5. 点击 **创建** 即可。

#### 命令行快速创建 (`gcloud`)：
```bash
gcloud scheduler jobs create http weekly-unified-archive \
    --schedule="0 2 * * 6" \
    --time-zone="America/Toronto" \
    --uri="https://<YOUR-API-HOST>/api/admin/archive/sync-all?days=35" \
    --http-method=POST \
    --headers="X-Admin-Secret=DispatchArchive2026!Secure,Content-Type=application/json" \
    --project=schoolbusdispatchapp
```

---

### 4. 业务无感知查询（Repository 自动兜底）

系统后端 Repository 内置了**双引擎智能路由**：
- 当调度员或管理员查询排班（`ListShifts`）、流水日志（`ListChangeLogs`）、请假单（`ListTimeOffRequests`）、车辆缺陷（`ListDefectReports`）、学生事故（`ListStudentIncidents`）、安全隐患（`ListHazardReports`）、路线评估（`ListRouteAssessments`）、车辆交接（`ListVehicleSignouts`）、出车前检查（`ListPreTripInspections`）或费用报销单（`ListExpenseClaims`），以及根据单号查询详情（`GetDefectReportByID` / `GetStudentIncidentByID` / `GetHazardReportByID` / `GetRouteAssessmentByID` / `GetVehicleSignoutByID` / `GetExpenseClaimByID`）时：
  1. 系统优先检索 Firestore 当前热数据；
  2. 对于历史单据或已归档数据，Repository 会自动透明兜底/合并检索 BigQuery 冷数据库并去重；
  3. 前端 Web 调度台与 Flutter 移动端完全无需改动，历史记录无缝呈现。

---

### 5. 手动测试与 CLI 归档工具

#### 使用 `curl` 手动触发测试：
```bash
# 1. 手动触发全量统一归档任务（班次、日志、14天出车检查、6个月费用报销、请假、超 180 天缺陷/事故、超 12 个月隐患/评估/交接单归档与清理）
curl -X POST "https://<YOUR-API-HOST>/api/admin/archive/sync-all?days=35" \
     -H "X-Admin-Secret: DispatchArchive2026!Secure"

# 2. 手动触发学年单据归档（事故、缺陷、隐患）
curl -X POST "https://<YOUR-API-HOST>/api/admin/archive/sync-annual?from=2025-09-01&to=2026-06-30" \
     -H "X-Admin-Secret: DispatchArchive2026!Secure"
```

#### 本地命令行工具使用 (`server/cmd/archive`)：
```bash
cd server

# 首次初始化 BigQuery 数据集与所有数据表
go run ./cmd/archive -init

# 本地执行一键全量归档（包含班次、日志、14天出车检查、6个月报销、请假单、180+天缺陷/事故、12个月隐患/评估/交接）
go run ./cmd/archive -sync-all

# 单独触发超期出车前检查归档（备份后清理，默认 14 天）
go run ./cmd/archive -archive-pretrips -pretrip-days=14

# 单独触发超期费用报销单归档（备份后清理，默认 6 个月）
go run ./cmd/archive -archive-expenses -expense-months=6

# 单独触发超期路线评估归档（备份后清理，默认 12 个月）
go run ./cmd/archive -archive-assessments -assessment-months=12

# 单独触发超期车辆交接归档（备份后清理，默认 12 个月）
go run ./cmd/archive -archive-handovers -handover-months=12

# 单独触发超期隐患归档（备份后清理，默认 12 个月）
go run ./cmd/archive -archive-hazards -hazard-months=12

# 单独触发超期事故/缺陷归档（备份后清理，默认 180 天）
go run ./cmd/archive -archive-incidents -incidents-days=180
```
