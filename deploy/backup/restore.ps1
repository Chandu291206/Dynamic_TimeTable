# ==============================================================================
# PostgreSQL Database Restore Script for Windows
# ==============================================================================

param(
    [Parameter(Mandatory = $true)]
    [string]$BackupFile,
    [string]$DbUrl,
    [switch]$Force,
    [string]$EnvFile = "$PSScriptRoot\..\..\backend\.env"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupFile)) {
    Write-Error "Backup file does not exist: $BackupFile"
    exit 1
}

# Resolve target DB URL
if (-not $DbUrl) {
    $DbUrl = $env:DATABASE_URL
    if (-not $DbUrl -and (Test-Path $EnvFile)) {
        $matched = Get-Content $EnvFile | Where-Object { $_ -match "^DATABASE_URL=(.+)$" }
        if ($matched) {
            $DbUrl = ($matched -split "=", 2)[1].Trim('"').Trim("'")
        }
    }
}

if (-not $DbUrl) {
    Write-Error "DATABASE_URL is not set and could not be loaded from $EnvFile"
    exit 1
}

Write-Host "==============================================================================" -ForegroundColor Red
Write-Host "WARNING: Restoring will overwrite existing tables in the target database!" -ForegroundColor Red
Write-Host "Backup File: $BackupFile" -ForegroundColor Yellow
Write-Host "==============================================================================" -ForegroundColor Red

if (-not $Force) {
    $confirm = Read-Host "Are you sure you want to proceed with database restore? (Type 'YES' to confirm)"
    if ($confirm -ne "YES") {
        Write-Host "Restore cancelled by user." -ForegroundColor Yellow
        exit 0
    }
} else {
    Write-Host "[INFO] -Force flag supplied: proceeding without interactive prompt." -ForegroundColor Yellow
}

$isSql = $BackupFile.EndsWith(".sql", [System.StringComparison]::OrdinalIgnoreCase)

if ($isSql) {
    Write-Host "Executing psql for plain SQL backup..." -ForegroundColor Cyan
    & psql -d "$DbUrl" -f "$BackupFile"
} else {
    Write-Host "Executing pg_restore for custom binary dump..." -ForegroundColor Cyan
    & pg_restore --clean --if-exists --no-owner --no-privileges -d "$DbUrl" "$BackupFile"
}

Write-Host "Restore execution finished." -ForegroundColor Green
