# ==============================================================================
# Automated Production Direct Deployment Script for Windows (No Docker)
# ==============================================================================

param(
    [string]$AppDir = "$PSScriptRoot\.."
)

$ErrorActionPreference = "Stop"

Write-Host "=== [1/5] Navigating to root directory: $AppDir ===" -ForegroundColor Cyan
Set-Location $AppDir

Write-Host "=== [2/5] Backend: Installing dependencies, generating Prisma, applying migrations ===" -ForegroundColor Cyan
Set-Location "$AppDir\backend"
npm ci --omit=dev
npm run prisma:generate
npm run prisma:migrate

Write-Host "=== [3/5] Frontend: Installing dependencies & compiling production bundle ===" -ForegroundColor Cyan
Set-Location "$AppDir\frontend"
npm ci
npm run build

Write-Host "=== [4/5] Process Management ===" -ForegroundColor Cyan
if (Get-Command pm2 -ErrorAction SilentlyContinue) {
    Write-Host "Restarting via PM2..." -ForegroundColor Green
    pm2 reload "$AppDir\deploy\pm2\ecosystem.config.cjs" --env production
} else {
    Write-Host "PM2 is not installed globally. Run 'npm install -g pm2' or run 'npm start' inside backend." -ForegroundColor Yellow
}

Write-Host "=== [5/5] Performing Health Check ===" -ForegroundColor Cyan
Start-Sleep -Seconds 2
try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/health" -Method Get
    if ($health.status -eq "ok") {
        Write-Host "Health check passed! API status: $($health.status)" -ForegroundColor Green
    }
} catch {
    Write-Host "Health check warning: Ensure backend process is running on port 5000." -ForegroundColor Yellow
}

Write-Host "Deployment script finished." -ForegroundColor Green
