# PostgreSQL Database Backup & Disaster Recovery Guide

This guide covers database backup, retention policy, and disaster recovery procedures for the Timetable Management System (Phase 33).

---

## 1. Quick Commands

### Minimum Native Commands (Section 38)

**Export:**
```bash
pg_dump "$DATABASE_URL" > timetable_backup.sql
```

**Restore:**
```bash
psql "$DATABASE_URL" < timetable_backup.sql
```

---

### Cross-Platform Node.js CLI (Recommended)

From the `backend` directory:

```bash
# 1. Create custom compressed binary backup (.dump)
npm run db:backup

# 2. Create plain text SQL backup (.sql)
npm run db:backup:sql

# 3. Verify the latest backup integrity without touching the database
npm run db:verify-backup

# 4. Restore a backup (prompts for confirmation)
npm run db:restore -- --file=../backups/timetable_backup_20261008_111543.dump

# 5. Restore with force (non-interactive, e.g. in automated pipelines)
npm run db:restore -- --file=../backups/timetable_backup_20261008_111543.dump --force
```

---

### PowerShell (Windows)

```powershell
# Custom binary archive (.dump) with 14-day retention
.\deploy\backup\backup.ps1

# Plain SQL script (.sql)
.\deploy\backup\backup.ps1 -Format plain

# Specific schema only (e.g. public)
.\deploy\backup\backup.ps1 -Schema public

# Restore (auto-detects .dump vs .sql)
.\deploy\backup\restore.ps1 -BackupFile ".\backups\timetable_backup_20261008_111543.dump"
```

---

### Bash (Linux / Production Server)

```bash
# Custom binary archive (.dump) with 14-day retention
./deploy/backup/backup.sh

# Plain SQL script (.sql)
FORMAT=plain ./deploy/backup/backup.sh

# Filter schema (e.g. public)
SCHEMA=public ./deploy/backup/backup.sh

# Restore
./deploy/backup/restore.sh /var/backups/timetable/timetable_backup_20261008_111543.dump
```

---

## 2. Automated Daily Backups

Set up an automated cron job to run daily at 02:00 AM server time:

```bash
# Open crontab editor
crontab -e

# Add the following entry:
0 2 * * * /var/www/timetable/deploy/backup/backup.sh >> /var/log/timetable/backup.log 2>&1
```

The backup script automatically:
1. Generates timestamped archives in the backup target directory (`timetable_backup_YYYYMMDD_HHmmss.dump` or `.sql`).
2. Enforces the **14-day retention policy** (automatically pruning dumps older than 14 days).
3. Verifies non-empty file creation.
4. Logs actions to `/var/log/timetable/backup.log`.

---

## 3. Disaster Recovery Drill & Verification

To verify that backups are restorable without affecting production:

### Automated Table Schema & TOC Verification
Run the verification utility against the newest backup:
```bash
npm --prefix backend run db:verify-backup
```
This inspects the backup archive Table of Contents (or SQL definitions) and confirms that all required application tables exist:
- `ClassRoom`
- `TimetableSlot`
- `TimetableOverride`
- `Faculty`
- `Subject`
- `User`

### Isolated Restore Drill
1. Create a temporary verification database:
   ```bash
   createdb -U postgres timetable_verify_test
   ```
2. Restore the latest backup into the test database:
   ```bash
   pg_restore --clean --if-exists --no-owner --no-privileges -d "postgresql://postgres:password@localhost:5432/timetable_verify_test" backups/timetable_backup_LATEST.dump
   ```
3. Verify table record counts:
   ```bash
   psql -d timetable_verify_test -c "SELECT COUNT(*) FROM \"ClassRoom\";"
   psql -d timetable_verify_test -c "SELECT COUNT(*) FROM \"TimetableSlot\";"
   psql -d timetable_verify_test -c "SELECT COUNT(*) FROM \"TimetableOverride\";"
   ```
4. Drop the test database when complete:
   ```bash
   dropdb -U postgres timetable_verify_test
   ```
