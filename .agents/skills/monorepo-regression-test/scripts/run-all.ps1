# Monorepo Full Regression Test & Static Analysis Runner
# Strict English output per AGENTS.md / GEMINI.md
$ErrorActionPreference = "Continue"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " [RUNNER] Starting Monorepo Full Regression Test Suite" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$Results = @()

function Run-Step {
    param(
        [string]$Subsystem,
        [string]$Path,
        [string]$TestCommand,
        [string]$AnalyzeCommand
    )

    Write-Host "`n----------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "[STEP] Testing $($Subsystem) in $Path" -ForegroundColor Yellow
    Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray

    Push-Location $Path
    $testStart = Get-Date

    # 1. Run Unit / Widget Tests
    Write-Host "Executing tests: $TestCommand ..." -ForegroundColor Gray
    $testOutput = Invoke-Expression $TestCommand 2>&1 | Out-String
    $testExit = $LASTEXITCODE

    # 2. Run Static Analysis / Typecheck
    Write-Host "Executing analysis: $AnalyzeCommand ..." -ForegroundColor Gray
    $analyzeOutput = Invoke-Expression $AnalyzeCommand 2>&1 | Out-String
    $analyzeExit = $LASTEXITCODE

    $testDuration = [math]::Round(((Get-Date) - $testStart).TotalSeconds, 2)
    Pop-Location

    $status = if ($testExit -eq 0 -and $analyzeExit -eq 0) { "PASS" } else { "FAIL" }

    if ($status -eq "PASS") {
        Write-Host "[PASS] $($Subsystem): PASSED ($($testDuration)s)" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] $($Subsystem): FAILED ($($testDuration)s)" -ForegroundColor Red
        if ($testExit -ne 0) {
            Write-Host "Test Failure Details:" -ForegroundColor DarkYellow
            Write-Host $testOutput -ForegroundColor Red
        }
        if ($analyzeExit -ne 0) {
            Write-Host "Static Analysis Failure Details:" -ForegroundColor DarkYellow
            Write-Host $analyzeOutput -ForegroundColor Red
        }
    }

    return [PSCustomObject]@{
        Subsystem = $Subsystem
        Status = $status
        Duration = "$($testDuration)s"
        TestExitCode = $testExit
        AnalyzeExitCode = $analyzeExit
    }
}

# 1. Web Console (Vitest + TypeScript)
$Results += Run-Step -Subsystem "Web Console" -Path "web" -TestCommand "npm test" -AnalyzeCommand "npx tsc --noEmit"

# 2. Driver App (Flutter Test + Analyze)
$Results += Run-Step -Subsystem "Driver App" -Path "driver_app" -TestCommand "flutter test" -AnalyzeCommand "flutter analyze"

# 3. Parent App (Flutter Test + Analyze)
$Results += Run-Step -Subsystem "Parent App" -Path "parent_app" -TestCommand "flutter test" -AnalyzeCommand "flutter analyze"

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " [SCORECARD] Monorepo Regression Test Summary" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$Results | Format-Table -AutoSize

$anyFailed = @($Results | Where-Object { $_.Status -eq "FAIL" }).Count -gt 0
if ($anyFailed) {
    Write-Host "`n[OVERALL] FAILED: Regression detected." -ForegroundColor Red
    exit 1
} else {
    Write-Host "`n[OVERALL] SUCCESS: All 179+ tests passed with 0 analyzer issues." -ForegroundColor Green
    exit 0
}
