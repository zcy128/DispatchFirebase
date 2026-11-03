# Web App Unit Test Instructions & Strategic Plan
### Instructions de tests unitaires et plan stratégique de l'application web
### Web 应用单元测试说明与规划方案

<p align="center">
  <strong><a href="#english">English</a></strong> |
  <strong><a href="#français">Français</a></strong> |
  <strong><a href="#français-eval">Évaluation (FR)</a></strong> |
  <strong><a href="#简体中文">简体中文</a></strong> |
  <strong><a href="#zh-evaluation">现有评估与规划 (中文)</a></strong>
</p>

---

> 💡 **Unified Monorepo Testing Guide**: For the comprehensive testing guide covering all subsystems (Web, Driver App, Parent App, and Browser E2E QA Agent), please refer to **[docs/testing-guide.md](testing-guide.md)** ([Français](testing-guide.md#français) | [简体中文](testing-guide.md#简体中文)).

<a name="english"></a>
## English: Web App Unit Test Instructions & Architecture Plan

Unit tests lock pure business rules and mission-critical calculations. They run in-memory within milliseconds without launching a browser, connecting to production Firestore, or relying on live API backends.

### 1. Assessment of Current Unit Tests

The Web console includes **13 test files** (`79 test cases`) powered by **Vitest** (`vitest run`):

| File | Rules Under Test | Level | Status & Assessment |
| :--- | :--- | :---: | :--- |
| `src/utils/payrollCalculator.test.ts` | Bi-weekly payroll totals, EI hours, stat holiday credits, expense merges, 2-decimal rounding | **P0** | ✅ **Solid**: Completely guards wage calculations against floating-point accumulation drift. |
| `src/utils/dispatchConflictDetector.test.ts` | Driver shift overlap, vehicle double-booking, approved driver time-off blockage | **P0** | ✅ **Solid**: Real-time scheduling conflict engine preventing double-assignment mistakes. |
| `src/utils/vehicleAvailabilityUtils.test.ts` | Out of service master statuses, active major defect quarantine, preventive maintenance locks | **P0** | ✅ **Solid**: Commercial vehicle compliance gate preventing grounded buses from dispatch. |
| `src/types/charter.test.ts` | Bilingual charter labels (EN/FR), 4-stop round-trip itinerary generation, employee ID sanitization | **P0** | ✅ **Solid**: Deterministic charter lifecycle states and route stop time extrapolation. |
| `src/utils/deadheadCalculator.test.ts` | Driver pull-out/pull-in deadhead distances, drive minutes with 1.28x circuity, attendant detour | **P1** | ✅ **Solid**: Protects operational mileage estimates and travel pay accuracy. |
| `src/utils/quickbooksPayrollExporter.test.ts` | QuickBooks Desktop IIF date (`MM/DD/YYYY`), H:MM time duration, and double-quoted CSV escaping | **P1** | ✅ **Solid**: Prevents accounting export corruption and import syntax failures. |
| `src/utils/stopSanitizer.test.ts` | Strips student privacy and confidential contacts; normalizes sequence, stop types, and GPS coords | **P2** | ✅ **Solid**: Enforces student privacy compliance on candidate driver previews. |
| `src/services/entityOperationLogService.test.ts` | Field diff engine for student and vehicle mutations (reassignments, capacity changes, status flags) | **P2** | ✅ **Solid**: Complete audit trail verification for operational compliance. |
| `src/utils/dateUtils.test.ts` | Calendar-day addition across Daylight Saving Time (DST), ISO date conversions, Friday 14:00 bidding deadlines | Core | ✅ **Solid**: Thoroughly guards against multi-day date drift during spring/autumn DST shifts. |
| `src/utils/permissions.test.ts` | Role aliases, driver read-only access (contacts/handovers), fleet managers, supervisor yard scoping | Core | ✅ **Solid**: Ensures permission boundaries cannot be bypassed via legacy role strings. |
| `src/utils/inspectionDateUtils.test.ts` | Inspection sticker month-end expiry, overdue flags, 30-day renewal windows, 2-year archival policy | Core | ✅ **Solid**: Locks commercial vehicle compliance windows under Ontario MTO standards. |
| `src/utils/dispatchDelayUtils.test.ts` | Delay minutes calculation, yellow warning (11+ min late), red overdue check-in, missing driver | Core | ✅ **Solid**: Real-time dispatch status color evaluation is completely deterministic. |
| `src/services/stopAssignmentService.test.ts` | Operating run days overlap detection, bell-time offset calculations (home stop ±28 min) | Core | ✅ **Good**: Protects route schedules from impossible student assignments. |

#### Full P0-P2 Suite Status:
- **P0, P1, and P2 Complete**: All mission-critical finance, conflict detection, routing algorithms, accounting exporters, and privacy sanitizers are 100% covered by unit tests executing in ~1.3 seconds.

---

### 2. Recommended Unit Test Roadmap for Web App

```text
Priority Matrix:
├── P0 (Financial Safety & Scheduling Conflicts) — Immediate
│   ├── Payroll Engine (Bi-weekly pay, EI hours, stat holiday credits, expenses)
│   ├── Dispatch Conflict Engine (Double-booking driver/vehicle, time-off overlap)
│   ├── Vehicle Availability Engine (Inspection lock, major defect quarantine)
│   └── Charter Order State Machine (Status transitions, billable hours math)
├── P1 (Dispatch Optimization & Data Integrity) — High
│   ├── Deadhead Mileage & Geo Calculations (Pull-out / pull-in buffers, Haversine)
│   ├── Accounting Exporters (QuickBooks CSV/IIF columns, rounding precision)
│   └── Route Opening & Seniority Bidding (Seniority ranking, 14:00 deadline cutoff)
└── P2 (Audit & Data Hygiene) — Medium
    ├── Stop Data Sanitizer (Address cleaning, GPS coordinate bounds)
    └── Audit Log Diff & Masking (Sensitive field masking, change record structure)
```

#### Detailed Recommended Test Suites:

#### 🔴 P0: Financial Safety & Core Operational Conflicts (High Risk)
1. **Bi-weekly Payroll Engine (`payrollCalculator.test.ts`)**:
   - Extract calculation logic from `BiweeklyPayrollView.tsx` / `payrollService.ts`.
   - Test standard shift rates, statutory holiday compensation (10-12 Statutory Holiday Credit), hourly EI deductions, expense reimbursement merges, and 2-decimal-place rounding (preventing floating point accumulation bugs).
2. **Dispatch Conflict Detection (`dispatchConflictService.test.ts`)**:
   - Detect conflicting shift times when a driver is assigned to overlapping AM/PM/Charter runs.
   - Guard against assigning drivers who have approved `time-off` requests for that specific shift date.
   - Detect vehicle double-assignment across simultaneous routes.
3. **Vehicle Availability & Compliance Locks (`vehicleAvailabilityUtils.test.ts`)**:
   - Prevent assigning vehicles with overdue safety inspections or unresolved `Major Defect` reports.
   - Verify vehicle active/inactive status and checkout status (`vehicleSignout`).
4. **Charter Order & Pricing Flow (`charterService.test.ts`)**:
   - Validate status state machine: `Draft -> Confirmed -> Assigned -> In Progress -> Completed / Cancelled`.
   - Verify calculation of billable hours, vehicle count scaling, and attendant pay rates.

#### 🟡 P1: Operational Optimization & Accounting Exports
5. **Deadhead & Geo Calculator (`deadheadCalculator.test.ts` & `geoUtils.test.ts`)**:
   - Verify yard-to-start (`pull-out`) and end-to-yard (`pull-in`) distance and buffer time math.
   - Haversine distance boundary tests (equator, antimeridian, identical points).
6. **Accounting Exporters (`quickbooksPayrollExporter.test.ts`)**:
   - Test CSV/IIF row formatting, debit/credit balancing, customer job tags, and escaping quotes/commas.
7. **Route Bidding & Seniority Engine (`routeOpeningService.test.ts`)**:
   - Test seniority-based selection algorithm when multiple drivers bid on the same route opening.
   - Verify automatic cutoff after Friday 14:00.

#### 🟢 P2: Sanitization & Audit Trails
8. **Stop Sanitizer (`stopSanitizer.test.ts`)**:
   - Coordinate latitude/longitude clamp (`[-90, 90]`, `[-180, 180]`), address trimming, and school bell validation.
9. **Audit Trail Formatter (`entityOperationLogService.test.ts`)**:
   - Verify audit record structure, timestamp tracking, and diff generation for sensitive modifications.

---

### 3. How to Run the Tests

From the `web` workspace directory:

```bash
cd web
npm test
```

To run with coverage:
```bash
npx vitest run --coverage
```

To watch files during test-driven development (TDD):
```bash
npx vitest
```

---

### 4. Writing New Unit Tests: Best Practices & Pitfalls

1. **Extract Pure Functions First**:
   If the business rule is nested inside a `.tsx` file, extract the pure calculation into `src/utils/` or `src/services/` without importing React hooks or JSX.
2. **Freeze the Clock with Fake Timers**:
   ```ts
   import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

   beforeEach(() => {
     vi.useFakeTimers();
     vi.setSystemTime(new Date(2026, 10, 2, 10, 0, 0)); // Nov 2, 2026
   });

   afterEach(() => {
     vi.useRealTimers();
   });
   ```
3. **Mock External Firebase Services**:
   ```ts
   vi.mock('./firebase', () => ({ db: null }));
   vi.mock('firebase/firestore', () => ({
     doc: vi.fn(),
     updateDoc: vi.fn(),
   }));
   ```
4. **Never Test UI Layout with Unit Tests**: Leave HTML structure, CSS layouts, and live server synchronizations to browser E2E / QA tests.

---

<a name="français"></a>
## Français : Instructions de tests unitaires et plan d'architecture

Les tests unitaires garantissent la robustesse des calculs financiers et des règles opérationnelles sans dépendance réseau, sans navigateur et sans connexion Firebase directe.

### 1. <a name="français-eval"></a> Évaluation de la suite actuelle

L'application Web compte désormais **13 fichiers de tests** (`79 cas de test`) exécutés par **Vitest** :

| Fichier | Règles testées | Niveau | Évaluation |
| :--- | :--- | :---: | :--- |
| `src/utils/payrollCalculator.test.ts` | Totaux de paie bimensuelle, heures d'assurance-emploi, congés fériés, réclamations de dépenses, arrondi à 2 décimales | **P0** | ✅ **Robuste** : Protège entièrement les montants contre les erreurs d'accumulation en virgule flottante. |
| `src/utils/dispatchConflictDetector.test.ts` | Chevauchement d'horaires des chauffeurs, double réservation de véhicules, blocage des congés approuvés | **P0** | ✅ **Robuste** : Moteur de prévention des erreurs de planification en temps réel. |
| `src/utils/vehicleAvailabilityUtils.test.ts` | Statuts hors service, mise en quarantaine pour anomalie majeure, verrous d'entretien périodique | **P0** | ✅ **Robuste** : Empêche l'assignation de véhicules non conformes ou immobilisés. |
| `src/types/charter.test.ts` | Libellés bilingues (FR/EN), génération automatique de l'itinéraire aller-retour à 4 arrêts, nettoyage des identifiants | **P0** | ✅ **Robuste** : Cycle de vie déterministe des commandes nolisées et calcul des temps d'arrêts. |
| `src/utils/deadheadCalculator.test.ts` | Distances de haut-le-pied (dépôt-départ, fin-dépôt) avec facteur 1.28x, temps de parcours et détour accompagnateur | **P1** | ✅ **Robuste** : Sécurise les estimations de carburant et la paie des temps de trajet à vide. |
| `src/utils/quickbooksPayrollExporter.test.ts` | Dates IIF QuickBooks Desktop (`MM/DD/YYYY`), durées H:MM, échappement des guillemets CSV | **P1** | ✅ **Robuste** : Prévient les rejets d'importation dans les logiciels comptables. |
| `src/utils/stopSanitizer.test.ts` | Dépersonnalisation des données d'élèves pour les candidats chauffeurs, coordonnées GPS de repli | **P2** | ✅ **Robuste** : Respect strict de la confidentialité des élèves. |
| `src/services/entityOperationLogService.test.ts` | Moteur de comparaison (diff) des modifications d'élèves et véhicules (réassignation, statut, capacité) | **P2** | ✅ **Robuste** : Traçabilité et piste d'audit certifiée. |
| `src/utils/dateUtils.test.ts` | Jours calendaires au changement d'heure (DST), dates ISO, date limite du vendredi à 14:00 | Base | ✅ **Robuste** : Évite les décalages de date lors du passage heure d'été/hiver. |
| `src/utils/permissions.test.ts` | Alias de rôles, accès lecture seule chauffeur, superviseurs par cour | Base | ✅ **Robuste** : Protège contre les contournements de permissions. |
| `src/utils/inspectionDateUtils.test.ts` | Expiration de macaron d'inspection, fenêtre de 30 jours, archivage de 2 ans | Base | ✅ **Robuste** : Conforme aux normes d'inspection MTO de l'Ontario. |
| `src/utils/dispatchDelayUtils.test.ts` | Calcul des retards, alerte jaune (+11 min), pointage rouge dépassé | Base | ✅ **Robuste** : Évaluation déterministe des statuts de retard. |
| `src/services/stopAssignmentService.test.ts` | Chevauchement des jours d'exploitation, décalage avec la cloche de l'école (±28 min) | Base | ✅ **Bon** : Empêche les assignations incohérentes d'élèves. |

#### Statut d'avancement :
- **Suites P0, P1 et P2 complétées** : Toutes les règles critiques sont entièrement vérifiées en moins de 1,5 seconde.

---

### 2. Plan stratégique des tests unitaires recommandés

#### 🔴 P0 : Sécurité financière et conflits de dispatch (Priorité Immédiate)
1. **Moteur de paie bimensuelle (`payrollCalculator.test.ts`)** :
   - Extraire le calcul pur de `BiweeklyPayrollView.tsx`.
   - Tester le cumul des heures régulières, heures d'assurance-emploi (EI), crédits de jours fériés statutaires, réclamations de dépenses approuvées et arrondissement strict à 2 décimales.
2. **Détecteur de conflits de dispatch (`dispatchConflictService.test.ts`)** :
   - Détection des chevauchements d'horaires pour un même chauffeur (AM / PM / Nolisé).
   - Interdiction de planifier un chauffeur ayant une demande de congé approuvée (`time-off`).
   - Détection des doubles réservations de véhicule sur des tournées simultanées.
3. **Verrouillage de conformité des véhicules (`vehicleAvailabilityUtils.test.ts`)** :
   - Blocage des véhicules avec inspection expirée ou défectuosité majeure non résolue (`Major Defect`).
4. **Machine à états des nolisés (`charterService.test.ts`)** :
   - Transition des états : Brouillon -> Confirmé -> Assigné -> En cours -> Terminé/Annulé.
   - Calcul des heures facturables et taux des accompagnateurs.

#### 🟡 P1 : Optimisation des tournées et exports comptables
5. **Calculateur de kilométrage à vide et géodonnées (`deadheadCalculator.test.ts`)** :
   - Temps et kilomètres de haut-le-pied (dépôt au premier arrêt et retour au dépôt).
6. **Exportation comptable QuickBooks (`quickbooksPayrollExporter.test.ts`)** :
   - Respect strict des colonnes IIF/CSV, équilibre débit/crédit et gestion des caractères réservés.
7. **Attribution des tournées par ancienneté (`routeOpeningService.test.ts`)** :
   - Sélection automatique par ancienneté et clôture des enchères le vendredi à 14h00.

#### 🟢 P2 : Hygiène des données et audit
8. **Nettoyeur d'arrêts (`stopSanitizer.test.ts`)** : Validation des coordonnées GPS et adresses.
9. **Journal d'audit (`entityOperationLogService.test.ts`)** : Masquage des données sensibles et formatage des différences.

---

<a name="简体中文"></a>
## 简体中文：Web 应用单元测试说明与架构规划

单元测试的核心使命是**锁定纯业务规则与财务计算**。测试纯在内存中极速运行（毫秒级），不打开浏览器、不连接生产环境 Firestore，亦不依赖动态后端网络。

---

### 1. <a name="zh-evaluation"></a> 现有单元测试评估

当前 Web 模块已全量扩展至 **13 个测试文件**（共计 **79 个用例**），采用 **Vitest** 运行驱动（`npm test`）：

| 测试文件 | 覆盖的业务规则 | 级别 | 现状评估与分析 |
| :--- | :--- | :---: | :--- |
| `src/utils/payrollCalculator.test.ts` | 双周工资汇总、EI 保险工时、法定假期补助、费用报销合并、两位小数四舍五入防浮点误差 | **P0** | ✅ **扎实**：纯函数完全解耦，从根本上锁死工资计算精度。 |
| `src/utils/dispatchConflictDetector.test.ts` | 司机班次时间重叠、车辆同一时间双重指派（Double-booking）、已批准请假（Time-off）排班阻断 | **P0** | ✅ **扎实**：为调度工作台提供确定性的排班冲突检测核心引擎。 |
| `src/utils/vehicleAvailabilityUtils.test.ts` | 车辆维保停运状态、未修复重大缺陷隔离锁、计划性预防保养（PM）日期锁定 | **P0** | ✅ **扎实**：严格合规守门，防止带病或停运校车被派单出车。 |
| `src/types/charter.test.ts` | 包车中英法双语标签、往返行程标准 4 站点自动生成、无效员工编号安全过滤 | **P0** | ✅ **扎实**：确定性包车订单生命周期与站点时间推算。 |
| `src/utils/deadheadCalculator.test.ts` | 司机出返场空载里程（1.28x 实际道路迂回系数）、空驶时间折算与随车乘务员接送绕行测算 | **P1** | ✅ **扎实**：保障出车燃油成本与空载工时津贴精准核算。 |
| `src/utils/quickbooksPayrollExporter.test.ts` | QuickBooks Desktop IIF 日期格式（`MM/DD/YYYY`）、`H:MM` 工时格式化、CSV 双引号转义 | **P1** | ✅ **扎实**：防止财务导出在会计软件中解析失败或格式错乱。 |
| `src/utils/stopSanitizer.test.ts` | 剥离学生姓名/学号/特教隐私与监护人电话，站点序号与坐标补齐 | **P2** | ✅ **扎实**：保障面向应聘候选司机的公开线路预览符合学生隐私保护合规。 |
| `src/services/entityOperationLogService.test.ts` | 学生资料与车队指派变更字段差量对比引擎（换司机、改路线、变更核载、状态开关） | **P2** | ✅ **扎实**：核心数据变更具备确定性审计轨迹。 |
| `src/utils/dateUtils.test.ts` | 跨春秋季夏令时（DST）日历日加天数、ISO 时间解析、周五 14:00 投标截止时间计算 | 基础 | ✅ **扎实**：有效杜绝了因时区/夏令时切换导致的排班日期漂移。 |
| `src/utils/permissions.test.ts` | 角色别名映射、司机只读通讯录/车辆交接、车队主管权限、分车场数据作用域 | 基础 | ✅ **扎实**：保证多租户与角色权限边界不被绕过。 |
| `src/utils/inspectionDateUtils.test.ts` | 车辆年检贴纸月末到期、逾期黄色/红色警告、30天窗口、两年归档策略 | 基础 | ✅ **扎实**：精准符合安省交通部（MTO）商用车安全检查法规周期。 |
| `src/utils/dispatchDelayUtils.test.ts` | 发车晚点分钟数计算、11+分钟黄色预警、过点未签到红色严重逾期 | 基础 | ✅ **扎实**：调度控制台实时延误状态计算完全确定性。 |
| `src/services/stopAssignmentService.test.ts` | 班次运行日重叠排斥、学生站点与学校上下课铃声时差计算（±28分钟） | 基础 | ✅ **良好**：杜绝向排班冲突的线路上强行指派学生。 |

#### 进展与收益：
- **P0、P1 与 P2 全量落地**：涵盖资金计算、排班防撞、出返场里程、财务导出、学生隐私脱敏及变更审计比对的全部核心纯逻辑已全部受自动化单元测试严密防护，执行耗时仅约 1.3 秒。

---

### 2. 建议补充的 Web App 单元测试规划矩阵

```text
规划层级：
├── 🔴 P0 资金核心与排班冲突（最高风险，优先补充）
│   ├── 双周薪酬计算引擎 (Bi-weekly Payroll Engine)
│   ├── 调度排班冲突检测引擎 (Dispatch Conflict Engine)
│   ├── 车辆可用性与缺陷停运锁 (Vehicle Availability Engine)
│   └── 包车订单状态流转与计费 (Charter Lifecycle Machine)
├── 🟡 P1 调度算法与数据导出（业务关键，稳步推进）
│   ├── 出返场空载里程与缓冲时间计算 (Deadhead & Geo Calculator)
│   ├── QuickBooks / 财务报表导出格式化 (Accounting Exporters)
│   └── 线路竞标与资历排序算法 (Route Bidding & Seniority Engine)
└── 🟢 P2 数据清洗与审计安全（健壮性保障）
    ├── 站点地理数据清洗与边界校验 (Stop Data Sanitizer)
    └── 实体变更审计追踪与脱敏 (Audit Trail Formatter)
```

#### 详细规划清单：

#### 🔴 P0：资金安全与核心调度冲突（立即补充）
1. **双周工资汇总纯函数计算（`payrollCalculator.test.ts`）**：
   - 从 `BiweeklyPayrollView.tsx` 和 `payrollService.ts` 中提取纯计算。
   - 测试用例：常规班次工时累加、EI 参保工时计算、加拿大安省法定假期津贴（10-12 Statutory Holiday Credit）、包车固定费率与小时费率折算、已审批报销款（Approved Expenses）合并、税前净支付金额（精确至分，防浮点精度丢失）。
2. **排班冲突检测引擎（`dispatchConflictService.test.ts`）**：
   - 司机同时间段重叠班次检测（如早班未结束被指派包车）。
   - 已获批请假（`time-off`）司机的发车指派阻断校验。
   - 同一辆校车在同一时间被多条线路或包车重复占用检测（Double-booking）。
3. **车辆可用性与合规安全锁（`vehicleAvailabilityUtils.test.ts`）**：
   - 年检过期车辆、存在未修复重大缺陷（`Major Defect`）的车辆强制进入“隔离/不可指派”状态。
   - 已处于借出（`vehicleSignout`）状态的车辆不可重复分配。
4. **包车订单状态机与计费（`charterService.test.ts`）**：
   - 验证状态机迁移：`Draft -> Confirmed -> Assigned -> In Progress -> Completed / Cancelled`。
   - 计费工时计算、车辆数量倍数分摊及随车乘务员补贴费率。

#### 🟡 P1：运营算法与财务导出
5. **空载里程与行车缓冲计算（`deadheadCalculator.test.ts` & `geoUtils.test.ts`）**：
   - 计算车场到起始站（Pull-out）与终点站回车场（Pull-in）的空驶距离与预留时间。
   - Haversine 地理测距边界情况验证。
6. **财务系统导出校验（`quickbooksPayrollExporter.test.ts`）**：
   - QuickBooks IIF / CSV 导出列对齐、借贷平衡校验、客户任务标签及特殊标点转义。
7. **线路竞标资历排序（`routeOpeningService.test.ts`）**：
   - 多司机竞标同一空缺线路时，按司机入职资历（Seniority）精准排序获胜者。
   - 周五 14:00 截止时间后的自动锁死逻辑。

#### 🟢 P2：数据清洗与安全审计
8. **站点数据纠错与清洗（`stopSanitizer.test.ts`）**：经纬度有效范围限定、地址前后空白清理与上下课时间校验。
9. **审计日志差量计算（`entityOperationLogService.test.ts`）**：关键操作（换人、改薪资、注销）前后对比快照结构与脱敏字段验证。

---

### 3. 如何运行测试

在 `web` 目录下执行：

```bash
cd web

# 运行所有单元测试
npm test

# 运行测试并查看覆盖率报告
npx vitest run --coverage

# 开启 TDD 监听模式（保存文件时自动重跑）
npx vitest
```

---

### 4. 编写新测试的避坑指南与最佳实践

1. **先抽离纯函数，再编写单测**：
   若业务规则深嵌在大型 `.tsx` 页面组件中，**切勿直接挂载巨型组件**；应先将业务逻辑抽取为无 React 依赖的独立纯函数，放置于 `src/utils/` 或 `src/services/` 中。
2. **使用假时钟冻结系统时间**：
   ```ts
   import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

   beforeEach(() => {
     vi.useFakeTimers();
     vi.setSystemTime(new Date(2026, 10, 2, 10, 0, 0)); // 2026-11-02
   });

   afterEach(() => {
     vi.useRealTimers();
   });
   ```
3. **Mock 隔离 Firebase/外部通信**：
   ```ts
   vi.mock('./firebase', () => ({ db: null }));
   vi.mock('firebase/firestore', () => ({
     doc: vi.fn(),
     updateDoc: vi.fn(),
   }));
   ```
4. **测试边界防御清单**：
   - 浮点数金额计算必须采用四舍五入锁定 2 位小数；
   - 遇到 `null`、空数组或未知枚举时具备安全的默认值；
   - 跨午夜与夏令时切换日的时间运算。
