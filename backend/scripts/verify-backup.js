#!/usr/bin/env node
/**
 * Backup Verification and Drill Utility.
 * Inspects a backup archive or directory and verifies that critical tables exist
 * in the backup manifest without modifying the active database.
 *
 * Usage:
 *   node scripts/verify-backup.js [--file=path/to/backup.dump] [--dir=./backups]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REQUIRED_TABLES = [
  'ClassRoom',
  'TimetableSlot',
  'TimetableOverride',
  'Faculty',
  'Subject',
  'User',
];

function findLatestBackup(dir) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir)
    .filter((f) => /^timetable_backup_.*\.(dump|sql)$/.test(f))
    .map((f) => {
      const fullPath = path.join(dir, f);
      return { path: fullPath, name: f, mtime: fs.statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);

  return files.length > 0 ? files[0] : null;
}

function verifyCustomDump(filePath) {
  console.log(`[VERIFY] Inspecting custom archive dump: ${filePath}`);
  const tocOutput = execSync(`pg_restore --list "${filePath}"`, { encoding: 'utf8' });

  const foundTables = [];
  const missingTables = [];

  for (const table of REQUIRED_TABLES) {
    // Check if table name appears in TOC
    const regex = new RegExp(`TABLE\\s+public\\s+${table}\\b`, 'i');
    if (regex.test(tocOutput)) {
      foundTables.push(table);
    } else {
      missingTables.push(table);
    }
  }

  return {
    valid: missingTables.length === 0,
    foundTables,
    missingTables,
    format: 'custom',
  };
}

function verifySqlDump(filePath) {
  console.log(`[VERIFY] Inspecting SQL text backup: ${filePath}`);
  const content = fs.readFileSync(filePath, 'utf8');

  const foundTables = [];
  const missingTables = [];

  for (const table of REQUIRED_TABLES) {
    const regex = new RegExp(`CREATE TABLE.*"${table}"|INSERT INTO.*"${table}"|COPY public\\."${table}"`, 'i');
    if (regex.test(content)) {
      foundTables.push(table);
    } else {
      missingTables.push(table);
    }
  }

  return {
    valid: missingTables.length === 0,
    foundTables,
    missingTables,
    format: 'sql',
  };
}

function runVerification() {
  const args = process.argv.slice(2);
  let targetFile = null;
  let searchDir = path.resolve(__dirname, '../../backups');

  for (const arg of args) {
    if (arg.startsWith('--file=')) {
      targetFile = path.resolve(process.cwd(), arg.split('=')[1]);
    } else if (arg.startsWith('--dir=')) {
      searchDir = path.resolve(process.cwd(), arg.split('=')[1]);
    }
  }

  if (!targetFile) {
    const latest = findLatestBackup(searchDir);
    if (!latest) {
      console.error(`[ERROR] No backups found in ${searchDir}`);
      process.exit(1);
    }
    targetFile = latest.path;
  }

  if (!fs.existsSync(targetFile)) {
    console.error(`[ERROR] File not found: ${targetFile}`);
    process.exit(1);
  }

  const stats = fs.statSync(targetFile);
  console.log(`[INFO] Verifying backup: ${path.basename(targetFile)} (${stats.size} bytes)`);

  const result = targetFile.toLowerCase().endsWith('.sql')
    ? verifySqlDump(targetFile)
    : verifyCustomDump(targetFile);

  console.log(`[INFO] Tables present (${result.foundTables.length}/${REQUIRED_TABLES.length}): ${result.foundTables.join(', ')}`);

  if (!result.valid) {
    console.error(`[FAIL] Missing required tables: ${result.missingTables.join(', ')}`);
    process.exit(1);
  }

  console.log('[SUCCESS] Backup verification passed! All required timetable tables and schemas verified.');
}

if (require.main === module) {
  try {
    runVerification();
  } catch (err) {
    console.error('[ERROR] Verification failed:', err.message);
    process.exit(1);
  }
}

module.exports = { findLatestBackup, verifyCustomDump, verifySqlDump, REQUIRED_TABLES };
