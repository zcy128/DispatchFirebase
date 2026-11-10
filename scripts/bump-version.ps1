# Automated Version Bump Script for Dispatch Monorepo
# Follows Project Rules in AGENTS.md:
# - Web: patch version in web/package.json and web/package-lock.json
# - Driver App: increment patch and +build in driver_app/pubspec.yaml
# - Parent App: increment patch and +build in parent_app/pubspec.yaml

param (
    [switch]$ForceWeb = $false,
    [switch]$ForceDriver = $false,
    [switch]$ForceParent = $false
)

$ErrorActionPreference = "Stop"

function Bump-FlutterPubspec([string]$filePath) {
    if (-not (Test-Path $filePath)) {
        Write-Warning "File not found: $filePath"
        return
    }

    $content = Get-Content -Path $filePath -Raw
    if ($content -match 'version:\s*(\d+)\.(\d+)\.(\d+)\+(\d+)') {
        $major = [int]$matches[1]
        $minor = [int]$matches[2]
        $patch = [int]$matches[3] + 1
        $build = [int]$matches[4] + 1
        $newVersion = "$major.$minor.$patch+$build"

        $updated = $content -replace 'version:\s*(\d+)\.(\d+)\.(\d+)\+(\d+)', "version: $newVersion"
        Set-Content -Path $filePath -Value $updated -NoNewline
        Write-Host "Bumped $filePath to $newVersion"
    } else {
        Write-Warning "Could not parse version in $filePath"
    }
}

function Bump-Web([string]$webDir) {
    if (-not (Test-Path $webDir)) {
        Write-Warning "Directory not found: $webDir"
        return
    }
    Push-Location $webDir
    try {
        $out = npm version patch --no-git-tag-version
        Write-Host "Bumped Web version to $out"
    } finally {
        Pop-Location
    }
}

function Bump-Server([string]$mainGoPath) {
    if (-not (Test-Path $mainGoPath)) {
        Write-Warning "File not found: $mainGoPath"
        return
    }

    $content = Get-Content -Path $mainGoPath -Raw
    if ($content -match 'defaultAPIVersion\s*=\s*"(\d+)\.(\d+)\.(\d+)"') {
        $major = [int]$matches[1]
        $minor = [int]$matches[2]
        $patch = [int]$matches[3] + 1
        $newVersion = "$major.$minor.$patch"

        $updated = $content -replace 'defaultAPIVersion\s*=\s*"(\d+)\.(\d+)\.(\d+)"', "defaultAPIVersion = `"$newVersion`""
        Set-Content -Path $mainGoPath -Value $updated -NoNewline
        Write-Host "Bumped Server API version in $mainGoPath to $newVersion"
    } else {
        Write-Warning "Could not parse defaultAPIVersion in $mainGoPath"
    }
}

# Determine which apps changed using git status / diff against HEAD
$changedFiles = git status --porcelain
$hasWebChanges = $ForceWeb -or ($changedFiles -match 'web/')
$hasServerChanges = ($changedFiles -match 'server/')
$hasDriverChanges = $ForceDriver -or ($changedFiles -match 'driver_app/')
$hasParentChanges = $ForceParent -or ($changedFiles -match 'parent_app/')

if ($hasWebChanges) {
    Bump-Web "web"
}

if ($hasServerChanges) {
    Bump-Server "server/cmd/server/main.go"
}

if ($hasDriverChanges) {
    Bump-FlutterPubspec "driver_app/pubspec.yaml"
}

if ($hasParentChanges) {
    Bump-FlutterPubspec "parent_app/pubspec.yaml"
}

if (-not ($hasWebChanges -or $hasDriverChanges -or $hasParentChanges)) {
    Write-Host "No app modifications detected. Skipping version bump."
}
