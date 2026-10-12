#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# PostgreSQL Database Restore Script for Timetable Management System
# ==============================================================================

if [ $# -lt 1 ]; then
    echo "Usage: $0 <path_to_backup_file> [target_database_url] [--force]"
    echo "Example: $0 /var/backups/timetable/timetable_backup_20261008_020000.dump"
    exit 1
fi

BACKUP_FILE="$1"
TARGET_DB_URL=""
FORCE=false
ENV_FILE="${ENV_FILE:-/var/www/timetable/backend/.env}"

for arg in "$@"; do
    if [ "$arg" = "--force" ] || [ "$arg" = "-f" ]; then
        FORCE=true
    elif [ "$arg" != "$BACKUP_FILE" ] && [ -z "$TARGET_DB_URL" ]; then
        TARGET_DB_URL="$arg"
    fi
done

if [ ! -f "$BACKUP_FILE" ]; then
    echo "[ERROR] Backup file not found: $BACKUP_FILE" >&2
    exit 1
fi

# Load target DATABASE_URL
if [ -z "$TARGET_DB_URL" ]; then
    if [ -n "${DATABASE_URL:-}" ]; then
        TARGET_DB_URL="$DATABASE_URL"
    elif [ -f "$ENV_FILE" ]; then
        TARGET_DB_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'")
    fi
fi

if [ -z "$TARGET_DB_URL" ]; then
    echo "[ERROR] No database URL provided and none found in $ENV_FILE" >&2
    exit 1
fi

echo "=============================================================================="
echo "WARNING: Restoring will overwrite existing tables in the destination database!"
echo "Backup File: $BACKUP_FILE"
echo "=============================================================================="

if [ "$FORCE" = false ]; then
    read -p "Are you sure you want to proceed with the restore? (y/N): " -r CONFIRM
    if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
        echo "Restore cancelled by user."
        exit 0
    fi
else
    echo "[INFO] --force supplied: proceeding without interactive prompt."
fi

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [INFO] Executing restore..."

if [[ "$BACKUP_FILE" == *.sql ]]; then
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [INFO] Detected plain SQL backup. Executing psql..."
    psql -d "$TARGET_DB_URL" -f "$BACKUP_FILE"
else
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [INFO] Detected custom archive dump. Executing pg_restore..."
    if pg_restore --clean --if-exists --no-owner --no-privileges -d "$TARGET_DB_URL" "$BACKUP_FILE"; then
        echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [SUCCESS] Database restored successfully!"
    else
        echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [INFO] pg_restore completed with warnings or notices."
    fi
fi

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [SUCCESS] Restore operation finished."
