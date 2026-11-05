---
name: monorepo-regression-test
description: Runs full monorepo regression tests (Web Vitest, Driver App Flutter test, Parent App Flutter test) and static typechecks/analyzers, generating a unified health scorecard. Trigger when asked to 'run all tests', 'regression test', '回归测试', '全栈测试', 'pre-flight check', 'monorepo test', or 'check test suite'.
---

# Monorepo Full Regression Test Skill

This skill automates the execution and auditing of all **179+ unit/widget tests** and static code analyzers across all three application workspaces in the repository (`web`, `driver_app`, and `parent_app`).

## When to Use This Skill
- Before creating a release or merging major code changes.
- After modifying shared types, API contracts, or core business calculations.
- When the user asks:
  - "Run all tests" / "Run full test suite"
  - "回归测试" / "全栈测试" / "检查所有测试"
  - "Pre-flight check" / "Check test status"

---

## Execution Protocol

### Option A: One-Command Runner (PowerShell)
Execute the unified companion script directly from the root workspace:

```powershell
powershell -ExecutionPolicy Bypass -File .agents/skills/monorepo-regression-test/scripts/run-all.ps1
```

---

### Option B: Step-by-Step Terminal Execution

#### Step 1: Web Console (`web/`)
1. Run Vitest Unit Tests:
   ```bash
   cd web && npm test
   ```
   - **Expectation**: 79 tests passed across 13 test files in < 3s.
2. Run TypeScript Type Check:
   ```bash
   cd web && npx tsc --noEmit
   ```
   - **Expectation**: Exit code 0 with 0 errors.

#### Step 2: Driver & Monitor Mobile App (`driver_app/`)
1. Run Flutter Unit & Widget Tests:
   ```bash
   cd driver_app && flutter test
   ```
   - **Expectation**: 49 tests passed in < 15s.
2. Run Flutter Static Analysis:
   ```bash
   cd driver_app && flutter analyze
   ```
   - **Expectation**: `No issues found!`.

#### Step 3: Parent Bus Tracker App (`parent_app/`)
1. Run Flutter Unit & Widget Tests:
   ```bash
   cd parent_app && flutter test
   ```
   - **Expectation**: 51 tests passed in < 20s.
2. Run Flutter Static Analysis:
   ```bash
   cd parent_app && flutter analyze
   ```
   - **Expectation**: `No issues found!`.

---

## Output Scorecard Template

Always synthesize test results into this structured Markdown scorecard:

```markdown
### 📊 Monorepo Full Regression Test Scorecard

| Subsystem / Workspace | Technology | Test Results | Static Analysis / Types | Duration | Status |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Web Console** (`web/`) | Vitest (TS 5.7) | **79 / 79** Passed | 0 Errors (`tsc --noEmit`) | ~2.1s | ✅ PASS |
| **Driver App** (`driver_app/`) | Flutter Test (Dart) | **49 / 49** Passed | 0 Warnings (`flutter analyze`) | ~12.5s | ✅ PASS |
| **Parent App** (`parent_app/`) | Flutter Test (Dart) | **51 / 51** Passed | 0 Warnings (`flutter analyze`) | ~16.2s | ✅ PASS |

**Overall Result**: ✅ **ALL 179+ TESTS PASSED (0 Regressions)**
```

---

## Failure Remediation Protocol

If any test or analyzer fails during execution:
1. **Never ignore or silence the failure**.
2. **Extract Key Diagnostic Info**:
   - Failing test name and file path.
   - Exact failure assertion and stack trace.
3. **Pinpoint Root Cause**:
   - Compare with recent git diff (`git diff`).
   - Check if floating point calculation violated 2-decimal half-up rounding.
   - Check if viewport constraint was violated in Flutter widget test.
4. **Remediate and Re-verify**:
   - Apply minimal, precise fix.
   - Re-run the specific failing test suite.
   - Re-run the full regression script to ensure 0 side-effects.
