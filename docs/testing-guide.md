# Monorepo Master Testing Guide & Browser QA Agent
### Guide Principal des Tests du Monorepo et Agent QA Navigateur
### Monorepo 统一测试指南与浏览器自动化 QA 智能体

<p align="center">
  <strong><a href="#english">English</a></strong> |
  <strong><a href="#français">Français</a></strong> |
  <strong><a href="#简体中文">简体中文</a></strong>
</p>

---

<a name="english"></a>
## 🌐 English: Master Testing Architecture & QA Protocol

This monorepo employs a multi-tiered testing strategy spanning **179+ automated unit and widget tests** alongside an **autonomous browser E2E QA agent**:
- **Pure Logic & Financial Safety (Web)**: Vitest suite safeguarding payroll, scheduling conflicts, vehicle compliance, and accounting exports.
- **Field Operations & Inspections (Driver App)**: Flutter test suite verifying daily timesheets, Schedule 5 vehicle inspections, and offline resilience.
- **Family Experience & Geolocation (Parent App)**: Flutter test suite verifying road-snapping geometry, OTP authentication state machines, live Bento ETA countdowns, and master schedule filtering.
- **Automated Browser UI & E2E Verification (Agent QA)**: Live browser automation agent (`.agents/agents/qa-tester.md`) performing Chrome DevTools Console error auditing, Network traffic validation, and complete CRUD user flows.

---

### 1. Unified Quick Start (Run All Tests)

Execute all test suites across the monorepo in terminal:

```bash
# 1. Web Management Console (79 Vitest tests)
cd web && npm test

# 2. Driver & Monitor Mobile App (49 Flutter tests)
cd ../driver_app && flutter test

# 3. Parent Bus Tracker App (51 Flutter tests)
cd ../parent_app && flutter test
```

To run static code analysis and linting:
```bash
# Web TypeScript Type Check
cd web && npx tsc --noEmit

# Driver App Static Analysis
cd ../driver_app && flutter analyze

# Parent App Static Analysis
cd ../parent_app && flutter analyze
```

> 💡 **Automated One-Command Regression Skill**:
> Run the full suite across all workspaces in one shot:
> ```powershell
> powershell -ExecutionPolicy Bypass -File .agents/skills/monorepo-regression-test/scripts/run-all.ps1
> ```
> Or ask Antigravity: *"Run full monorepo regression test"* to trigger the **[`monorepo-regression-test`](../.agents/skills/monorepo-regression-test/SKILL.md)** skill.

---

### 2. Comprehensive Test Suites Index & Direct Links

| Subsystem / Workspace | Technology | Test Count | Key Modules Under Test | Detailed Documentation |
| :--- | :---: | :---: | :--- | :--- |
| **Web Console** (`web/`) | Vitest (TypeScript) | **79** | Bi-weekly payroll, dispatch conflict detection, MTO inspection compliance, charter orders, deadhead distance, QuickBooks export, stop sanitizer, audit log diffs | [docs/unit-test-instructions.md](file:///d:/DispatchFirebase/docs/unit-test-instructions.md) |
| **Driver App** (`driver_app/`) | Flutter Test (Dart) | **49** | Timesheet hourly rates & divide-by-zero protection, Charter 4-stop itinerary math, Schedule 5 pre-trip rating, offline Base64 fallback, session token cleanup | [driver_app/TESTING.md](file:///d:/DispatchFirebase/driver_app/TESTING.md) ([FR](file:///d:/DispatchFirebase/driver_app/TESTING.fr.md) \| [ZH](file:///d:/DispatchFirebase/driver_app/TESTING.zh.md)) |
| **Parent App** (`parent_app/`) | Flutter Test (Dart) | **51** | Encoded polyline road snapping (45m threshold), data model null tolerance, AuthBloc OTP flow, Bento countdown, master schedule shift filters, dispatcher hub, notification & profile sheets | [parent_app/TESTING.md](file:///d:/DispatchFirebase/parent_app/TESTING.md) ([FR](file:///d:/DispatchFirebase/parent_app/TESTING.fr.md) \| [ZH](file:///d:/DispatchFirebase/parent_app/TESTING.zh.md)) |
| **Browser E2E QA Agent** | Chrome DevTools Automation | **Full E2E** | Live browser navigation, Console JavaScript error capture, Network XHR/Fetch status checking (HTTP 200/201 vs 4xx/5xx), full CRUD operations & invalid submission boundary tests | [`.agents/agents/qa-tester.md`](file:///d:/DispatchFirebase/.agents/agents/qa-tester.md) |

---

### 3. Browser E2E Testing with QA Agent (`.agents/agents/qa-tester.md`)

The monorepo includes a dedicated autonomous browser test agent located at [`.agents/agents/qa-tester.md`](file:///d:/DispatchFirebase/.agents/agents/qa-tester.md).

#### Specification & Persona:
The QA agent acts as an uncompromising Senior Automated QA Test Engineer that runs live end-to-end tests against frontend web pages (`parent_app` on `http://localhost:5000` or `web` on `http://localhost:3000`) and the Go backend API.

#### Standard QA Execution Protocol:
1. **Launch Browser**: Opens the target URL using built-in browser tools (defaults to `http://localhost:3000` or `http://localhost:5000/parent/`).
2. **Omnidirectional Monitoring**:
   - **Console Panel**: Audits Chrome DevTools for JavaScript uncaught exceptions, framework warnings, or unhandled Promise rejections.
   - **Network (XHR/Fetch) Panel**: Audits all requests sent to backend endpoints. Verifies URL structure, payloads, and ensures HTTP 200/201 responses without 4xx/5xx failures.
3. **Interactive CRUD Traversals**:
   - **Read**: Verifies initial page state and table/list rendering without white screens or garbled characters.
   - **Create**: Tests "Add/Create" workflows with valid mock data, as well as **empty or malformed submissions** to verify client-side validation barriers.
   - **Update/Delete**: Tests edit forms and deletion actions, confirming real-time UI refresh.
4. **Reporting Rules**:
   - **All Pass**: Outputs `✅ QA 测试通过` accompanied by screenshots of critical user journeys.
   - **Defect Found**: Immediately halts test, captures screenshot of failure state, pinpoints exact root cause in source code (e.g. `POST /api/employees returned 500 due to missing field validation`), and hands report over for remediation.

#### How to Invoke the QA Agent:
Prompt the AI assistant or Antigravity runner:
> *"Please use @[.agents/agents/qa-tester.md] to test the Parent App live on http://localhost:5000"*

> 🤖 **Specialized Subagent Suite**: In addition to `qa-tester`, the project includes dedicated subagents for security review, API contract testing, performance profiling, bilingual EN/FR localization auditing, as well as React 19 web development, Vitest testing, and frontend code auditing. Refer to **[`.agents/README.md`](../.agents/README.md)**.

---

<a name="français"></a>
## 🌐 Français : Architecture Globale des Tests et Protocole QA

Ce monorepo applique une stratégie de test rigoureuse regroupant **plus de 179 tests unitaires et de composants** ainsi qu'un **agent autonome de test d'interface navigateur (E2E)** :
- **Règles Métier et Sécurité Financière (Web)** : Suite Vitest protégeant la paie, les conflits de planning, la conformité des véhicules et les exports comptables.
- **Opérations Terrain et Inspections (Driver App)** : Suite Flutter validant les feuilles d'heures, l'inspection pré-départ Annexe 5, et la résilience hors-ligne.
- **Expérience Famille et Géolocalisation (Parent App)** : Suite Flutter validant la projection routière sur carte, la machine à états OTP, le compte à rebours Bento ETA et le filtrage des horaires.
- **Validation Navigateur E2E (Agent QA)** : Agent d'automatisation réel (`.agents/agents/qa-tester.md`) surveillant la console Chrome DevTools, le trafic réseau et les parcours CRUD complets.

---

### 1. Démarrage Rapide

```bash
# 1. Console Web de Gestion (79 tests Vitest)
cd web && npm test

# 2. Application Chauffeur Mobile (49 tests Flutter)
cd ../driver_app && flutter test

# 3. Application Suivi Parents (51 tests Flutter)
cd ../parent_app && flutter test
```

> 💡 **Compétence d'Exécution en Une Seule Ligne** :
> Exécutez la suite complète de régression et d'analyse en une seule commande :
> ```powershell
> powershell -ExecutionPolicy Bypass -File .agents/skills/monorepo-regression-test/scripts/run-all.ps1
> ```
> Ou demandez à Antigravity : *"Exécuter les tests de régression du monorepo"* pour déclencher la compétence **[`monorepo-regression-test`](../.agents/skills/monorepo-regression-test/SKILL.md)**.

---

### 2. Index des Suites de Tests et Liens Directs

| Sous-système | Technologie | Nb Tests | Modules Clés Couverts | Guide Détaillé |
| :--- | :---: | :---: | :--- | :--- |
| **Console Web** (`web/`) | Vitest (TypeScript) | **79** | Paie bimensuelle, détection de conflits, conformité MTO, affrètements, exports QuickBooks, nettoyage des arrêts | [docs/unit-test-instructions.md](file:///d:/DispatchFirebase/docs/unit-test-instructions.md) |
| **Driver App** (`driver_app/`) | Flutter Test (Dart) | **49** | Taux horaires, itinéraire 4 arrêts d'affrètement, Annexe 5, repli hors-ligne Base64, purge des jetons | [driver_app/TESTING.fr.md](file:///d:/DispatchFirebase/driver_app/TESTING.fr.md) |
| **Parent App** (`parent_app/`) | Flutter Test (Dart) | **51** | Projection polyline (seuil 45m), tolérance null des modèles, AuthBloc OTP, compte à rebours Bento, support régulation | [parent_app/TESTING.fr.md](file:///d:/DispatchFirebase/parent_app/TESTING.fr.md) |
| **Agent QA Navigateur** | Chrome DevTools Automation | **E2E Global** | Navigation réelle, surveillance Console JavaScript, inspection Network (codes 200/201 vs 4xx/5xx), parcours CRUD et validation | [`.agents/agents/qa-tester.md`](file:///d:/DispatchFirebase/.agents/agents/qa-tester.md) |

---

### 3. Agent d'Automatisation Navigateur (`.agents/agents/qa-tester.md`)

Défini dans [`.agents/agents/qa-tester.md`](file:///d:/DispatchFirebase/.agents/agents/qa-tester.md), cet agent exécute :
1. **Lancement du Navigateur** sur l'URL cible (`http://localhost:5000` ou `http://localhost:3000`).
2. **Surveillance Console & Réseau** : Détection des erreurs JavaScript non capturées et audit des requêtes API REST.
3. **Parcours CRUD Complets** : Test de lecture, soumission valide, soumission vide/invalide, modification et suppression.
4. **Conclusion** : Rapport avec capture d'écran et mention explicite `✅ QA 测试通过` en cas de succès, ou diagnostic précis dans le code source en cas d'anomalie.

#### Comment Appeler l'Agent QA :
Demandez à l'assistant AI ou à Antigravity :
> *"Veuillez utiliser @[.agents/agents/qa-tester.md] pour tester l'application Parent App en direct sur http://localhost:5000"*

> 🤖 **Suite de Sous-Agents Spécialisés** : En plus de `qa-tester`, le monorepo met à disposition des sous-agents dédiés à la revue de sécurité, aux tests de contrats API, au profilage des performances, à l'audit bilingue EN/FR, ainsi qu'au développement React 19, aux tests Vitest et à l'audit de code Web. Consultez **[`.agents/README.md`](../.agents/README.md)**.

---

<a name="简体中文"></a>
## 🌐 简体中文：全项目统一测试架构与浏览器 QA 智能体

本项目在整个 Monorepo 建立了高密度、零多余外部依赖的自动化测试防护网，包含 **179+ 单元与 Widget 测试用例** 以及一个专门的 **浏览器端到端（E2E）自动化 QA 智能体**：
- **纯业务逻辑与财务安全（Web 端）**：基于 Vitest，守卫双周薪资计算、排班时段冲突检测、商用车合规隔离锁定与 QuickBooks 财务导出。
- **一线行车与安全点检（司机端 Driver App）**：基于 Flutter Test，验证工时汇总、除以零防崩溃、Schedule 5 行车前安全点检及离线数据降级。
- **家长服务与实时定位（家长端 Parent App）**：基于 Flutter Test，验证 45 米阈值道路折线吸附算法、数据模型容错、AuthBloc 免密 OTP 状态机、Bento 倒计时卡片及全周时刻表筛选。
- **浏览器真实交互与联调测试（QA 智能体）**：通过 [`.agents/agents/qa-tester.md`](file:///d:/DispatchFirebase/.agents/agents/qa-tester.md)，调用真实浏览器监控 Console 报错、Network 请求状态码，并执行完整 CRUD 流程测试。

---

### 1. 统一快速运行指令

在任意终端依次执行以下指令，可在数秒内完成各端测试：

```bash
# 1. 运行调度管理 Web 端全部单元测试 (79 个测试)
cd web && npm test

# 2. 运行司机端 Driver App 全部单元测试 (49 个测试)
cd ../driver_app && flutter test

# 3. 运行家长端 Parent App 全部单元测试 (51 个测试)
cd ../parent_app && flutter test
```

静态代码质量与类型检查：
```bash
# Web 端 TypeScript 编译检查 (0 错误)
cd web && npx tsc --noEmit

# 司机端 Dart 静态分析 (0 警告)
cd ../driver_app && flutter analyze

# 家长端 Dart 静态分析 (0 警告)
cd ../parent_app && flutter analyze
```

> 💡 **一键自动化全栈回归 Skill**：
> 在根目录下单行命令一键跑通所有项目的单元测试与类型静态分析：
> ```powershell
> powershell -ExecutionPolicy Bypass -File .agents/skills/monorepo-regression-test/scripts/run-all.ps1
> ```
> 或直接向 Antigravity 提示：*“运行全栈回归测试”*，即可自动触发 **[`monorepo-regression-test`](../.agents/skills/monorepo-regression-test/SKILL.md)** 技能。

---

### 2. 统一测试模块索引与直达链接

| 模块系统 | 测试框架 | 测试数量 | 核心被测功能与业务规则 | 详细测试指南链接 |
| :--- | :---: | :---: | :--- | :--- |
| **Web 调度控制台** (`web/`) | Vitest (TypeScript) | **79** | 双周薪资计算（规避浮点累加漂移）、排班冲突（司机重叠/车辆双重预订/请假阻断）、车辆安检锁、包车订单状态机、空驶里程、QuickBooks 导出、学生隐私清洗 | [docs/unit-test-instructions.md](file:///d:/DispatchFirebase/docs/unit-test-instructions.md) |
| **司机端移动应用** (`driver_app/`) | Flutter Test (Dart) | **49** | 工时薪资算力与时段聚合、包车四站点时刻推算、Schedule 5 点检评级（重大缺陷阻断出车）、弱网 Base64 存储容错、登出敏感令牌注销 | [driver_app/TESTING.zh.md](file:///d:/DispatchFirebase/driver_app/TESTING.zh.md) ([EN](file:///d:/DispatchFirebase/driver_app/TESTING.md) \| [FR](file:///d:/DispatchFirebase/driver_app/TESTING.fr.md)) |
| **家长端追踪应用** (`parent_app/`) | Flutter Test (Dart) | **51** | 编码 Polyline 道路投影吸附（45m 阈值）、模型解析容错（`num` 转 `double`）、AuthBloc 状态机、Bento 预计到达卡片、时刻表筛选、调度中心服务台、通知与资料设置 | [parent_app/TESTING.zh.md](file:///d:/DispatchFirebase/parent_app/TESTING.zh.md) ([EN](file:///d:/DispatchFirebase/parent_app/TESTING.md) \| [FR](file:///d:/DispatchFirebase/parent_app/TESTING.fr.md)) |
| **浏览器自动化 QA 智能体** | Chrome DevTools 自动化 | **端到端 E2E** | 真实浏览器访问、DevTools Console 报错与警告监听、Network 接口请求状态码监控（200/201 vs 4xx/5xx）、表单空值/非法值校验、完整 CRUD 遍历 | [`.agents/agents/qa-tester.md`](file:///d:/DispatchFirebase/.agents/agents/qa-tester.md) |

---

### 3. 浏览器自动化测试智能体规范 (`.agents/agents/qa-tester.md`)

项目在 [`.agents/agents/qa-tester.md`](file:///d:/DispatchFirebase/.agents/agents/qa-tester.md) 中配置了专用的自动化 QA 测试智能体。

#### 设定与角色定位：
QA 智能体扮演一位极其严苛的资深自动化 QA 测试工程师，对前端页面（如 Parent App `http://localhost:5000` 或 Web Console `http://localhost:3000`）及其调用的 Go API 后端执行端到端真实测试。

#### 标准执行流程：
1. **启动浏览器**：调用浏览器工具打开目标 URL。
2. **全方位监控**：
   - **Console 面板**：持续捕获任何 JavaScript 异常、React/Vue 警告或未捕获的 Promise 错误。
   - **Network (XHR/Fetch) 面板**：监控所有后端请求的 URL、入参格式，确认 HTTP 状态码是否为 200/201，绝不允许未捕获的 4xx/5xx。
3. **页面交互遍历（CRUD）**：
   - **查（Read）**：验证初始列表正常加载，无白屏、无乱码。
   - **增（Create）**：测试新增提交，并强制测试**空值提交/非法格式提交**，验证前端校验逻辑是否生效。
   - **改/删（Update/Delete）**：执行编辑与删除，验证数据与界面是否实时同步。
4. **结果输出**：
   - 测试通过时输出：“✅ QA 测试通过”并附带关键步骤截图。
   - 发现缺陷时停止测试、截屏留档，并准确定位源码位置交由主 Agent 修复。

#### 如何触发浏览器 QA 智能体：
在与 Antigravity 对话中直接输入：
> *“请调用 @[.agents/agents/qa-tester.md] 测试 parent app 的页面（访问地址：http://localhost:5000）”*

> 🤖 **专业子智能体矩阵**：除 `qa-tester` 外，项目还配置了安全合规审查、API 契约渗透、性能资源泄漏排查、双语（英法）国际化审计，以及针对 Web 端的 React 19 架构开发、Vitest 单测编写与前端代码质量审计等专业子智能体。详见说明文档：**[`.agents/README.md`](../.agents/README.md)**。
