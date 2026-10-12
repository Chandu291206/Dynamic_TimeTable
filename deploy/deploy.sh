#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Automated Production Direct Deployment Script (No Docker)
# ==============================================================================

APP_DIR="${APP_DIR:-/var/www/timetable}"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"

echo "=== [1/6] Navigating to project directory: $APP_DIR ==="
cd "$APP_DIR"

echo "=== [2/6] Installing backend production dependencies & applying migrations ==="
cd "$BACKEND_DIR"
npm ci --omit=dev
npm run prisma:generate
npm run prisma:migrate

echo "=== [3/6] Installing frontend dependencies & compiling production bundle ==="
cd "$FRONTEND_DIR"
npm ci
npm run build

echo "=== [4/6] Restarting backend service ==="
if command -v pm2 >/dev/null 2>&1; then
    echo "Restarting via PM2..."
    pm2 reload "$APP_DIR/deploy/pm2/ecosystem.config.cjs" --env production || \
    pm2 start "$APP_DIR/deploy/pm2/ecosystem.config.cjs" --env production
elif systemctl is-active --quiet timetable-backend; then
    echo "Restarting via systemd..."
    sudo systemctl restart timetable-backend
else
    echo "Warning: Neither PM2 nor timetable-backend systemd service found active."
    echo "Please start the backend process manually or install PM2."
fi

echo "=== [5/6] Reloading Nginx ==="
if command -v nginx >/dev/null 2>&1; then
    sudo nginx -t && sudo nginx -s reload
    echo "Nginx reloaded successfully."
fi

echo "=== [6/6] Health Check ==="
sleep 2
if curl -sSf http://127.0.0.1:5000/api/health >/dev/null; then
    echo "API health check passed: http://127.0.0.1:5000/api/health is OK"
    echo "Deployment completed successfully!"
else
    echo "Error: Health check failed. Check backend logs for details."
    exit 1
fi
