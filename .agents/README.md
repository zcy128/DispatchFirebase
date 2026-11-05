# Monorepo Subagents Directory & Operational Manual
### Répertoire des Sous-Agents du Monorepo et Manuel Opérationnel
### Monorepo 专属子智能体套件与操作手册

<p align="center">
  <strong><a href="#english">English</a></strong> |
  <strong><a href="#français">Français</a></strong> |
  <strong><a href="#简体中文">简体中文</a></strong>
</p>

---

> ℹ️ **Notice on System Languages vs. Documentation**:
> - **Application Runtime**: The application suite (`web`, `driver_app`, `parent_app`) strictly supports **two languages: English (`en`) and French (`fr`)**.
> - **Documentation & Developer Guides**: Technical documentation and instructions are provided in **three languages: English, Français, and 简体中文** for developer convenience.

---

<a name="english"></a>
## 🌐 English: Specialized Subagents Manual

This monorepo utilizes specialized, on-demand subagents located in `.agents/agents/`. These subagents run independently without consuming baseline token budget during routine conversations, activating only when invoked directly or referenced via `@`.

### 1. Agents Catalog

| Agent Name | Configuration File | Primary Role | Trigger Prompt Example |
| :--- | :--- | :--- | :--- |
| **`qa-tester`** | [`.agents/agents/qa-tester.md`](agents/qa-tester.md) | End-to-end browser UI automation, DevTools Console auditing, Network monitoring, full CRUD flow validation. | *"Please use @[.agents/agents/qa-tester.md] to test the Parent App on http://localhost:5000"* |
| **`security-code-reviewer`** | [`.agents/agents/security-code-reviewer.md`](agents/security-code-reviewer.md) | Strict code safety review, secret leakage prevention, no-Chinese-in-code enforcement, financial 2-decimal half-up precision. | *"Review git diff with @[.agents/agents/security-code-reviewer.md] before commit"* |
| **`api-contract-tester`** | [`.agents/agents/api-contract-tester.md`](agents/api-contract-tester.md) | Go backend API verification, authentication boundary penetration (401/403), input validation, Go/TS/Dart contract sync. | *"Test the new absence dispatch API using @[.agents/agents/api-contract-tester.md]"* |
| **`performance-profiler`** | [`.agents/agents/performance-profiler.md`](agents/performance-profiler.md) | Flutter lifecycle & resource leak inspection (`dispose`), Web re-render prevention, CanvasKit performance, Firestore batch safety. | *"Profile tracking_home_screen.dart using @[.agents/agents/performance-profiler.md]"* |
| **`i18n-auditor`** | [`.agents/agents/i18n-auditor.md`](agents/i18n-auditor.md) | Enforces strict English & French (**EN / FR only**) UI bilingualism, scans for hardcoded text, validates key parity between `en` and `fr`. | *"Audit bilingual compliance using @[.agents/agents/i18n-auditor.md]"* |
| **`react-web-developer`** | [`.agents/agents/react-web-developer.md`](agents/react-web-developer.md) | React 19 + TypeScript architecture, Tailwind styling, reusable UI components, custom hooks, and Firebase realtime listeners. | *"Develop the charter quote approval panel with @[.agents/agents/react-web-developer.md]"* |
| **`react-test-engineer`** | [`.agents/agents/react-test-engineer.md`](agents/react-test-engineer.md) | Web Vitest test authoring, pure computation invariants (payroll/conflict), Firebase mock isolation, fast deterministic test suites. | *"Write Vitest unit tests for the payroll exporter using @[.agents/agents/react-test-engineer.md]"* |
| **`react-code-auditor`** | [`.agents/agents/react-code-auditor.md`](agents/react-code-auditor.md) | React 19 quality inspection, Hooks dependency & stale closure traps, `@tanstack/react-virtual` optimization, `tsc` zero-error gate. | *"Audit web components before production release using @[.agents/agents/react-code-auditor.md]"* |

---

### 2. Standard Operating Procedures (SOP)

#### A. Automated Browser QA (`qa-tester.md`)
- Launches live browser targeting `http://localhost:3000` (Web Console) or `http://localhost:5000` (Parent App).
- Monitored channels: Chrome DevTools Console for unhandled exceptions; Network panel for HTTP 200/201 vs 4xx/5xx failures.
- Conducts full CRUD traversals including boundary invalid submissions.
- Delivers `✅ QA 测试通过` with screenshots or pinpoints source code lines for defects.

#### B. Security & Clean Code Reviewer (`security-code-reviewer.md`)
- Inspects code diffs against `AGENTS.md` and `GEMINI.md`.
- Enforces zero non-English characters in identifiers, comments, logs, and files.
- Confirms financial calculations round to 2 decimal places using half-up rounding.
- Validates that commercial vehicle major defect locks cannot be bypassed.

#### C. API & Contract Tester (`api-contract-tester.md`)
- Executes HTTP tests against Go microservice (`http://localhost:8080/api/...`).
- Validates penetration barriers: unauthorized requests receive `401`, deactivated drivers receive `403`.
- Verifies input validation returns `400 Bad Request` instead of server panic `500`.
- Synchronizes Go `struct` tags with TypeScript `interface` in `web/` and Dart `class` in mobile apps.

#### D. Performance & Resource Profiler (`performance-profiler.md`)
- Validates that all controllers (`AnimationController`, `TextEditingController`, `Timer`, `StreamSubscription`) are canceled in `dispose()`.
- Verifies lazy list builders (`ListView.builder`, `SliverList`) for high-volume telemetry.
- Audits Firestore reads/writes to ensure batch processing and prevent unpaginated query bursts.

#### E. Bilingual i18n Auditor (`i18n-auditor.md`)
- Confirms runtime UI dictionaries strictly adhere to English (`en`) and French (`fr`) only.
- Scans presentation templates (`.tsx`, `.dart`) for hardcoded strings not wrapped in `t('...')`.
- Performs bidirectional dictionary diffs between `en` and `fr` to prevent missing translations.

#### F. React Web Feature & Architecture Developer (`react-web-developer.md`)
- Implements modular React 19 components and custom hooks under `web/src/`.
- Enforces strict TypeScript interfaces and types; runs `cd web && npx tsc --noEmit`.
- Leverages Tailwind CSS 3.4 with `clsx` / `tailwind-merge` and Lucide icons.
- Ensures all Firebase listeners unsubscribe cleanly upon unmount to eliminate memory leaks.
- Enforces English code/comments and wraps all UI text in `useI18n()` (EN / FR only).

#### G. React & Vitest Test Engineer (`react-test-engineer.md`)
- Writes fast, deterministic Vitest tests (`*.test.ts(x)`) with zero live network dependencies.
- Mocks Firebase Auth and Firestore cleanly with in-memory test doubles.
- Validates payroll half-up 2-decimal precision, conflict intervals, and QuickBooks export formatting.
- Verifies that `cd web && npm test` passes 100% of tests (79+ tests in < 5s).

#### H. React 19 Quality & Architecture Auditor (`react-code-auditor.md`)
- Inspects `useEffect`, `useCallback`, and `useMemo` dependency arrays for missing variables and stale closure traps.
- Verifies large data views use `@tanstack/react-virtual` to avoid DOM inflation.
- Audits Service Worker caching in `vite-plugin-pwa` to prevent stale client version lockups.
- Confirms TypeScript compiles with 0 errors via `cd web && npx tsc --noEmit`.

---

### 3. Workspace Custom Skills (`.agents/skills/`)

Skills teach the agent specialized multi-step execution runbooks and procedural workflows.

| Skill Name | Path | Description | Trigger Example |
| :--- | :--- | :--- | :--- |
| **`monorepo-regression-test`** | [`.agents/skills/monorepo-regression-test/SKILL.md`](skills/monorepo-regression-test/SKILL.md) | Orchestrates complete regression testing across Web, Driver App, and Parent App (179+ tests) plus `tsc` and `flutter analyze`. | *"Run all tests across the monorepo"* or *"Pre-flight regression check"* |

---

<a name="français"></a>
## 🌐 Français : Manuel des Sous-Agents Spécialisés

Ce monorepo intègre une suite de sous-agents autonomes situés dans `.agents/agents/`. Ils opèrent à la demande sans consommer de jetons de contexte en temps normal, et s'activent uniquement lors d'une invocation explicite ou d'une mention `@`.

### 1. Répertoire des Agents

| Nom de l'Agent | Fichier | Rôle Principal | Exemple d'Invocation |
| :--- | :--- | :--- | :--- |
| **`qa-tester`** | [`.agents/agents/qa-tester.md`](agents/qa-tester.md) | Automatisation UI sur navigateur réel, audit Console DevTools, vérification Network et parcours CRUD complets. | *"Veuillez tester l'app parents sur http://localhost:5000 avec @[.agents/agents/qa-tester.md]"* |
| **`security-code-reviewer`** | [`.agents/agents/security-code-reviewer.md`](agents/security-code-reviewer.md) | Examen strict de la sécurité, prévention de fuites de clés, interdiction du chinois dans le code, précision de paie à 2 décimales. | *"Auditer les modifications avec @[.agents/agents/security-code-reviewer.md]"* |
| **`api-contract-tester`** | [`.agents/agents/api-contract-tester.md`](agents/api-contract-tester.md) | Validation d'API Go, tests d'autorisation (401/403), validation des entrées et cohérence des contrats Go/TS/Dart. | *"Tester les routes d'API avec @[.agents/agents/api-contract-tester.md]"* |
| **`performance-profiler`** | [`.agents/agents/performance-profiler.md`](agents/performance-profiler.md) | Diagnostic de fuites de mémoire Flutter (`dispose`), optimisation du re-rendu Web, rendu CanvasKit et requêtes Firestore. | *"Analyser la mémoire de l'écran de suivi avec @[.agents/agents/performance-profiler.md]"* |
| **`i18n-auditor`** | [`.agents/agents/i18n-auditor.md`](agents/i18n-auditor.md) | Respect strict du bilinguisme Anglais/Français (**EN / FR uniquement**), détection de texte codé en dur et alignement des clés. | *"Vérifier la conformité bilingue avec @[.agents/agents/i18n-auditor.md]"* |
| **`react-web-developer`** | [`.agents/agents/react-web-developer.md`](agents/react-web-developer.md) | Architecture React 19 + TypeScript, mise en page Tailwind CSS, composants réutilisables, hooks personnalisés et écouteurs Firebase. | *"Développer le module d'affrètement avec @[.agents/agents/react-web-developer.md]"* |
| **`react-test-engineer`** | [`.agents/agents/react-test-engineer.md`](agents/react-test-engineer.md) | Rédaction des tests unitaires Vitest, invariants de calcul (paie/conflits), isolation par mocks Firebase, exécution déterministe. | *"Écrire les tests Vitest pour le calcul de paie avec @[.agents/agents/react-test-engineer.md]"* |
| **`react-code-auditor`** | [`.agents/agents/react-code-auditor.md`](agents/react-code-auditor.md) | Audit qualité React 19, pièges de dépendances Hooks, virtualisation `@tanstack/react-virtual`, et compilation TypeScript sans erreur. | *"Auditer les composants Web avant mise en production avec @[.agents/agents/react-code-auditor.md]"* |

---

### 2. Procédures Opérationnelles Normalisées (SOP)

- **`qa-tester`** : Démarre le navigateur, capture les erreurs JavaScript et les statuts HTTP réseau, valide la soumission de formulaires vides ou invalides, et fournit des captures d'écran.
- **`security-code-reviewer`** : Applique `AGENTS.md` / `GEMINI.md`, vérifie l'absence de secret et d'identifiant non-anglais dans les fichiers, garantit l'arrondi de paie à 2 décimales et le verrouillage des véhicules en cas de défectuosité majeure.
- **`api-contract-tester`** : Injecte des charges utiles invalides pour s'assurer que le serveur Go répond `400` et jamais `500`, vérifie le rejet des comptes inactifs (`403`) et valide l'alignement des structures de données.
- **`performance-profiler`** : Examine les cycles de vie Flutter pour s'assurer que contrôleurs et minuteurs sont bien libérés, et bloque les requêtes Firestore non paginées ou répétées dans des boucles.
- **`i18n-auditor`** : Vérifie que le système applique rigoureusement la politique bilingue officielle (Anglais / Français), sans texte chinois dans l'interface et sans clé de traduction orpheline.
- **`react-web-developer`** : Conçoit des vues et composants modulaires dans `web/src/`, applique Tailwind CSS 3.4 et `clsx`, désabonne rigoureusement les flux Firestore au démontage et vérifie `npx tsc --noEmit`.
- **`react-test-engineer`** : Écrit des tests Vitest rapides et isolés dans `web/src/**/*.test.ts`, simule Firebase, vérifie l'arrondi monétaire et garantit 100% de réussite lors de `npm test`.
- **`react-code-auditor`** : Analyse les tableaux de dépendances (`useEffect`, `useCallback`), audite la virtualisation des listes denses avec `@tanstack/react-virtual` et bloque toute erreur de type TypeScript.

---

### 3. Compétences Locales de l'Espace de Travail (`.agents/skills/`)

Les compétences (Skills) fournissent à l'agent des manuels d'exécution (Runbooks) et des procédures multi-étapes réutilisables.

| Nom de la Compétence | Chemin | Description | Exemple d'Appel |
| :--- | :--- | :--- | :--- |
| **`monorepo-regression-test`** | [`.agents/skills/monorepo-regression-test/SKILL.md`](skills/monorepo-regression-test/SKILL.md) | Exécute la suite complète de régression sur Web, Driver App et Parent App (plus de 179 tests) avec `tsc` et `flutter analyze`. | *"Exécuter tous les tests du projet"* ou *"Vérification de régression globale"* |

---

<a name="简体中文"></a>
## 🌐 简体中文：专属子智能体套件与操作手册

本项目在 `.agents/agents/` 目录下部署了 8 个职责明确、彼此互补的专家级子智能体（Subagents）。它们具备“按需唤醒（On-Demand）”特性，日常会话中**零占用 Token 预算**，仅在通过 `@` 明确调用或由主智能体派发专项任务时启动。

### 1. 智能体资产清单

| 智能体名称 | 配置文件路径 | 核心专职角色 | 调用指令示例 |
| :--- | :--- | :--- | :--- |
| **`qa-tester`** | [`.agents/agents/qa-tester.md`](agents/qa-tester.md) | 真实浏览器端到端（E2E）自动化测试、DevTools 控制台报错捕获、网络接口审计与全量 CRUD 遍历。 | *“请调用 @[.agents/agents/qa-tester.md] 测试 http://localhost:5000 的家长端应用”* |
| **`security-code-reviewer`** | [`.agents/agents/security-code-reviewer.md`](agents/security-code-reviewer.md) | 深度代码安全审查、密钥泄露拦截、严禁中文进代码铁律、薪资浮点 2 位四舍五入与商用车缺陷锁保障。 | *“在提交代码前，使用 @[.agents/agents/security-code-reviewer.md] 审查所有修改文件”* |
| **`api-contract-tester`** | [`.agents/agents/api-contract-tester.md`](agents/api-contract-tester.md) | Go 后端微服务 API 黑白盒测试、越权渗透防御（401/403）、参数异常边界拦截与跨端数据契约对齐。 | *“请使用 @[.agents/agents/api-contract-tester.md] 测试最新的请假接口契约”* |
| **`performance-profiler`** | [`.agents/agents/performance-profiler.md`](agents/performance-profiler.md) | Flutter 生命周期与资源泄露排查（`dispose` 审计）、React 重复渲染治理、CanvasKit 掉帧与 Firestore 批量安全。 | *“请使用 @[.agents/agents/performance-profiler.md] 检查 tracking_home_screen 是否有泄露”* |
| **`i18n-auditor`** | [`.agents/agents/i18n-auditor.md`](agents/i18n-auditor.md) | 严苛的双语国际化合规巡检（**应用界面仅支持英文与法文 EN/FR**），抓取裸露硬编码文本，双向校验键对齐。 | *“请调用 @[.agents/agents/i18n-auditor.md] 扫描 web 和 parent_app 的多语言规范”* |
| **`react-web-developer`** | [`.agents/agents/react-web-developer.md`](agents/react-web-developer.md) | React 19 现代化前端架构、TypeScript 强类型接口定义、Tailwind CSS 响应式布局与 Firebase 实时流管理。 | *“请使用 @[.agents/agents/react-web-developer.md] 开发包车订单审批模块”* |
| **`react-test-engineer`** | [`.agents/agents/react-test-engineer.md`](agents/react-test-engineer.md) | Web 控制台 Vitest 单元与集成测试编写，业务计算逻辑覆盖（薪资/排班冲突）、Firebase 内存隔离 Mock。 | *“请使用 @[.agents/agents/react-test-engineer.md] 为薪资导出编写 Vitest 单测”* |
| **`react-code-auditor`** | [`.agents/agents/react-code-auditor.md`](agents/react-code-auditor.md) | React 19 质量与性能审计、Hooks 依赖与陈旧闭包排查、`@tanstack/react-virtual` 大列表优化、TypeScript 编译门禁。 | *“在代码发版前，调用 @[.agents/agents/react-code-auditor.md] 审计 Web 端组件架构”* |

---

### 2. 标准作业程序与执行规范 (SOP)

#### A. 浏览器端到端 QA 智能体 (`qa-tester.md`)
1. 打开浏览器访问指定 URL（Parent App `http://localhost:5000` 或 Web Console `http://localhost:3000`）。
2. 全程监听 Chrome DevTools 的 Console 面板（抓取 JS 报错/未处理 Promise）与 Network 面板（确保状态码为 200/201，绝不允许 4xx/5xx）。
3. 执行 CRUD 页面交互，并强制测试**空值与畸形输入**，验证前端防呆拦截。
4. 全部通过输出 `✅ QA 测试通过` 附带截图；发现缺陷则截屏并精准定位源码行号。

#### B. 安全与代码合规审查员 (`security-code-reviewer.md`)
1. 检查代码改动，严格落实 `GEMINI.md` / `AGENTS.md`：标识符、函数名、注释、控制台日志绝不允许包含中文字符。
2. 扫描敏感文件，严禁硬编码真实 Token、密码、私钥或 `.env` 凭证。
3. 财务底线检查：薪资计算与汇总必须四舍五入锁定 2 位小数，防止浮点漂移。
4. 商用车合规：重大缺陷（Major Defect）未修复前绝不可解锁出车。

#### C. API 接口与跨端契约测试员 (`api-contract-tester.md`)
1. 发送 HTTP 请求测试 Go 后端（`http://localhost:8080/api/...`）。
2. 权限穿透测试：未携带 Token 必须返回 `401 Unauthorized`；已停用员工 Token 必须返回 `403 Forbidden`。
3. 异常边界注入：空 Body、类型错误字段必须返回 `400 Bad Request`，绝不允许服务端产生 Panic 或 `500`。
4. 契约对比：Go `struct` 的 JSON 标签与 Web 端的 TypeScript `interface`、移动端的 Dart `class` 全链路对齐。

#### D. 性能与生命周期诊断师 (`performance-profiler.md`)
1. 逐一核查 `StatefulWidget` 内创建的所有 Controller（动画、文本、定时器、数据流订阅），确认在 `dispose()` 中被完全释放。
2. 检查大列表是否应用懒加载，避免一次性渲染海量子组件导致 CanvasKit 掉帧。
3. 审计 Firestore 交互：严禁在循环体中执行读取或写入，必须使用批处理（`batch`）与合理分页限制。

#### E. 双语国际化合规督查员 (`i18n-auditor.md`)
1. **明确系统双语标准**：目标系统运行时**仅支持英语（`en`）和法语（`fr`）两套语言版本**（参考 `web/src/contexts/I18nContext.tsx`），严禁混入中文或其它语言作为 UI 选项。
2. **硬编码文本排查**：抓取所有直接裸露在 `.tsx` 和 `.dart` 视图文件中的静态英文字符串。
3. **英法词典双向校验**：比对 `en` 与 `fr` 词典清单，确保无遗漏翻译与孤立键。

#### F. React 前端开发与架构工程师 (`react-web-developer.md`)
1. 规范开发 `web/src/` 下的视图（`views/`）、通用组件（`components/`）与自定义 Hook（`hooks/`）。
2. 在 `web/src/types/` 中严格定义 TypeScript 数据模型，杜绝使用 `any`。
3. 规范应用 Tailwind CSS 与 `clsx` / `tailwind-merge`，保持界面风格整洁一致。
4. 严格管理 Firebase 实时监听订阅与清理，确保组件卸载时调用 `unsubscribe()`。
5. 落实纯英文代码与注释，UI 文本严格接入 `useI18n()`（仅限 EN / FR 双语）。

#### G. React & Vitest 单元测试专家 (`react-test-engineer.md`)
1. 编写运行快速、零外部网络依赖的 Vitest 单测（`*.test.ts(x)`）。
2. 使用内存 Mock 模拟 Firebase Auth 和 Firestore，杜绝偶发性网络依赖。
3. 重点守卫薪资 2 位四舍五入、排班时段交叉冲突、QuickBooks CSV 转义与学生数据脱敏。
4. 确保 `cd web && npm test` 79+ 测试 100% 稳定秒级通过。

#### H. React 质量与架构审查师 (`react-code-auditor.md`)
1. 全面排查 `useEffect` / `useCallback` 依赖遗漏、闭包陈旧状态与状态自死锁。
2. 针对高密度数据表格（排班矩阵、司机花名册），确认正确应用 `@tanstack/react-virtual` 虚拟化渲染。
3. 审查 `vite-plugin-pwa` 缓存配置，防止版本发布后旧资源死锁。
4. 执行 `cd web && npx tsc --noEmit`，确保无类型报错与潜在运行时隐患。

---

### 3. 项目工作区专属技能矩阵 (`.agents/skills/`)

技能（Skills）为 AI 提供高度封装的标准作业程序（Runbook / SOP），在触发特定工程任务时自动分步执行。

| 技能名称 | 目录路径 | 核心能力与自动化流程 | 调用指令示例 |
| :--- | :--- | :--- | :--- |
| **`monorepo-regression-test`** | [`.agents/skills/monorepo-regression-test/SKILL.md`](skills/monorepo-regression-test/SKILL.md) | 一键串行或并行执行 Web、Driver App 与 Parent App 全套 179+ 单元/组件测试及类型静态分析，自动汇总健康评分看板。 | *“运行全栈回归测试”*、*“检查全项目测试”* 或 *“run all tests”* |
