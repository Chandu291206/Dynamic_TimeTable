#!/usr/bin/env node
/**
 * Cross-platform PostgreSQL database backup utility for Timetable Management System.
 * Supports both custom compressed archives (.dump) and plain SQL (.sql).
 *
 * Usage:
 *   node scripts/db-backup.js [--format=custom|plain|sql] [--schema=public] [--retention=14] [--dir=./backups]
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    format: 'custom',
    schema: '',
    retentionDays: 14,
    backupDir: path.resolve(__dirname, '../../backups'),
  };

  for (const arg of args) {
    if (arg.startsWith('--format=')) {
      const fmt = arg.split('=')[1].toLowerCase();
      options.format = fmt === 'sql' || fmt === 'plain' ? 'plain' : 'custom';
    } else if (arg.startsWith('--schema=')) {
      options.schema = arg.split('=')[1];
    } else if (arg.startsWith('--retention=')) {
      options.retentionDays = parseInt(arg.split('=')[1], 10) || 14;
    } else if (arg.startsWith('--dir=')) {
      options.backupDir = path.resolve(process.cwd(), arg.split('=')[1]);
    }
  }

  return options;
}

function formatDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${y}${m}${d}_${hh}${mm}${ss}`;
}

function enforceRetention(dir, retentionDays) {
  if (!fs.existsSync(dir)) return;
  const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const entries = fs.readdirSync(dir);

  for (const file of entries) {
    if (/^timetable_backup_.*\.(dump|sql)$/.test(file)) {
      const fullPath = path.join(dir, file);
      try {
        const stats = fs.statSync(fullPath);
        if (stats.mtimeMs < cutoffTime) {
          fs.unlinkSync(fullPath);
          console.log(`[RETENTION] Purged expired backup: ${file}`);
        }
      } catch (err) {
        console.warn(`[RETENTION] Could not process ${file}:`, err.message);
      }
    }
  }
}

async function runBackup() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('[ERROR] DATABASE_URL is not set. Check backend/.env');
    process.exit(1);
  }

  const { format, schema, retentionDays, backupDir } = parseArgs();

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const ext = format === 'plain' ? 'sql' : 'dump';
  const timestamp = formatDate(new Date());
  const filename = `timetable_backup_${timestamp}.${ext}`;
  const targetPath = path.join(backupDir, filename);

  const dumpFormat = format === 'plain' ? 'plain' : 'custom';
  const args = [dbUrl, `--format=${dumpFormat}`, `--file=${targetPath}`];
  if (schema) {
    args.push(`--schema=${schema}`);
  }

  console.log(`[INFO] Starting PostgreSQL database backup (${dumpFormat} format)...`);
  console.log(`[INFO] Destination: ${targetPath}`);
  if (schema) console.log(`[INFO] Filtered schema: ${schema}`);

  const startTime = Date.now();

  const child = spawn('pg_dump', args, {
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: false,
    windowsHide: true,
  });

  let stderr = '';
  child.stderr.on('data', (d) => {
    stderr += d.toString();
  });

  child.on('close', (code) => {
    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
    if (code === 0 && fs.existsSync(targetPath)) {
      const stats = fs.statSync(targetPath);
      console.log(`[SUCCESS] Backup created successfully (${stats.size} bytes in ${elapsedSec}s).`);
      console.log(`[INFO] Enforcing ${retentionDays}-day retention policy...`);
      enforceRetention(backupDir, retentionDays);
      console.log('[SUCCESS] Backup routine finished.');
    } else {
      console.error(`[ERROR] pg_dump failed with exit code ${code}`);
      if (stderr) console.error(stderr);
      if (fs.existsSync(targetPath)) {
        try { fs.unlinkSync(targetPath); } catch {}
      }
      process.exit(code || 1);
    }
  });
}

if (require.main === module) {
  runBackup().catch((err) => {
    console.error('[FATAL]', err);
    process.exit(1);
  });
}

module.exports = { parseArgs, formatDate, enforceRetention };
