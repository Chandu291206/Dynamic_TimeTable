# ==============================================================================
# Automated PostgreSQL Backup Script for Windows
# ==============================================================================

param(
    [string]$BackupDir = "$PSScriptRoot\..\..\backups",
    [int]$RetentionDays = 14,
    [ValidateSet("custom", "plain")][string]$Format = "custom",
    [string]$Schema = "",
    [string]$EnvFile = "$PSScriptRoot\..\..\backend\.env"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

# Read DATABASE_URL from .env if not set in environment
$DbUrl = $env:DATABASE_URL
if (-not $DbUrl -and (Test-Path $EnvFile)) {
    $matched = Get-Content $EnvFile | Where-Object { $_ -match "^DATABASE_URL=(.+)$" }
    if ($matched) {
        $DbUrl = ($matched -split "=", 2)[1].Trim('"').Trim("'")
    }
}

if (-not $DbUrl) {
    Write-Error "DATABASE_URL is not set and could not be loaded from $EnvFile"
    exit 1
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$ext = if ($Format -eq "plain") { "sql" } else { "dump" }
$backupFile = Join-Path $BackupDir "timetable_backup_$timestamp.$ext"

Write-Host "[$((Get-Date).ToString('u'))] [INFO] Starting PostgreSQL database backup ($Format format)..." -ForegroundColor Cyan
Write-Host "[$((Get-Date).ToString('u'))] [INFO] Target file: $backupFile" -ForegroundColor Cyan

# Build arguments
$dumpArgs = @("$DbUrl")
if ($Format -eq "custom") {
    $dumpArgs += "--format=custom"
} else {
    $dumpArgs += "--format=plain"
}

if ($Schema) {
    $dumpArgs += "--schema=$Schema"
    Write-Host "[$((Get-Date).ToString('u'))] [INFO] Filtering schema: $Schema" -ForegroundColor Cyan
}

$dumpArgs += "--file=$backupFile"

# Execute pg_dump
try {
    & pg_dump @dumpArgs
    if ($LASTEXITCODE -eq 0 -and (Test-Path $backupFile)) {
        $fileSize = (Get-Item $backupFile).Length
        Write-Host "[$((Get-Date).ToString('u'))] [SUCCESS] Backup created successfully ($fileSize bytes)." -ForegroundColor Green
    } else {
        throw "pg_dump failed with exit code $LASTEXITCODE"
    }
} catch {
    Write-Error "Backup failed: $_"
    if (Test-Path $backupFile) { Remove-Item $backupFile -Force }
    exit 1
}

# Enforce retention policy
Write-Host "[$((Get-Date).ToString('u'))] [INFO] Enforcing $RetentionDays-day retention policy..." -ForegroundColor Cyan
$cutoffDate = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -Path $BackupDir | Where-Object { 
    ($_.Name -like "timetable_backup_*.dump" -or $_.Name -like "timetable_backup_*.sql") -and 
    ($_.LastWriteTime -lt $cutoffDate)
} | ForEach-Object {
    Write-Host "Purging expired backup: $($_.Name)" -ForegroundColor Yellow
    Remove-Item $_.FullName -Force
}

Write-Host "[$((Get-Date).ToString('u'))] [SUCCESS] Backup routine finished." -ForegroundColor Green
