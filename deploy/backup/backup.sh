#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Automated PostgreSQL Backup Script for Timetable Management System
# ==============================================================================

BACKUP_DIR="${BACKUP_DIR:-/var/backups/timetable}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
FORMAT="${FORMAT:-custom}" # "custom" (.dump) or "plain" (.sql)
SCHEMA="${SCHEMA:-}"       # e.g., "public"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

if [ "$FORMAT" = "plain" ] || [ "$FORMAT" = "sql" ]; then
    EXT="sql"
    DUMP_FMT="plain"
else
    EXT="dump"
    DUMP_FMT="custom"
fi

BACKUP_FILE="$BACKUP_DIR/timetable_backup_${TIMESTAMP}.${EXT}"
ENV_FILE="${ENV_FILE:-/var/www/timetable/backend/.env}"

# 1. Ensure backup directory exists
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# 2. Extract DATABASE_URL from environment or .env file
if [ -z "${DATABASE_URL:-}" ] && [ -f "$ENV_FILE" ]; then
    DATABASE_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'")
fi

if [ -z "${DATABASE_URL:-}" ]; then
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [ERROR] DATABASE_URL is not set and could not be loaded from $ENV_FILE" >&2
    exit 1
fi

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [INFO] Starting PostgreSQL database backup (${DUMP_FMT} format)..."
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [INFO] Destination: $BACKUP_FILE"

# 3. Assemble pg_dump arguments
DUMP_ARGS=("$DATABASE_URL" "--format=$DUMP_FMT" "--file=$BACKUP_FILE")
if [ -n "$SCHEMA" ]; then
    DUMP_ARGS+=("--schema=$SCHEMA")
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [INFO] Filtering schema: $SCHEMA"
fi

# 4. Execute pg_dump
if pg_dump "${DUMP_ARGS[@]}"; then
    FILESIZE=$(stat -c%s "$BACKUP_FILE" 2>/dev/null || stat -f%z "$BACKUP_FILE" 2>/dev/null || echo "unknown")
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [SUCCESS] Backup completed successfully. File size: ${FILESIZE} bytes."
else
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [ERROR] pg_dump failed!" >&2
    rm -f "$BACKUP_FILE"
    exit 1
fi

# 5. Enforce retention policy (delete backups older than RETENTION_DAYS)
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [INFO] Purging backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -type f \( -name "timetable_backup_*.dump" -o -name "timetable_backup_*.sql" \) -mtime +"$RETENTION_DAYS" -exec rm -f {} +

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [SUCCESS] Backup routine finished."
