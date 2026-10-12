#!/usr/bin/env node
/**
 * Cross-platform PostgreSQL database restore utility for Timetable Management System.
 * Supports both custom compressed archives (.dump via pg_restore) and plain SQL (.sql via psql).
 *
 * Usage:
 *   node scripts/db-restore.js --file=path/to/backup.dump [--target-url=postgresql://...] [--force]
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    file: '',
    targetUrl: '',
    force: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--file=')) {
      options.file = path.resolve(process.cwd(), arg.split('=')[1]);
    } else if (arg.startsWith('--target-url=')) {
      options.targetUrl = arg.split('=')[1];
    } else if (arg === '--force' || arg === '-f') {
      options.force = true;
    }
  }

  return options;
}

function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toUpperCase());
    });
  });
}

async function runRestore() {
  const { file, targetUrl, force } = parseArgs();

  if (!file) {
    console.error('Usage: node scripts/db-restore.js --file=path/to/backup.(dump|sql) [--target-url=...] [--force]');
    process.exit(1);
  }

  if (!fs.existsSync(file)) {
    console.error(`[ERROR] Backup file does not exist: ${file}`);
    process.exit(1);
  }

  const dbUrl = targetUrl || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('[ERROR] No target database URL supplied and DATABASE_URL is not set in backend/.env');
    process.exit(1);
  }

  console.log('==============================================================================');
  console.log('WARNING: Restoring will overwrite existing tables in the target database!');
  console.log(`Backup File: ${file}`);
  console.log('==============================================================================');

  if (!force) {
    const answer = await askConfirmation("Type 'YES' to confirm database restore: ");
    if (answer !== 'YES') {
      console.log('Restore cancelled by user.');
      process.exit(0);
    }
  } else {
    console.log('[INFO] --force supplied: proceeding without confirmation prompt.');
  }

  const isSql = file.toLowerCase().endsWith('.sql');
  const command = isSql ? 'psql' : 'pg_restore';
  const args = isSql
    ? ['-d', dbUrl, '-f', file]
    : ['--clean', '--if-exists', '--no-owner', '--no-privileges', '-d', dbUrl, file];

  console.log(`[INFO] Executing ${command}...`);

  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
  });

  child.on('close', (code) => {
    if (code === 0) {
      console.log('[SUCCESS] Database restored successfully!');
    } else {
      console.log(`[INFO] ${command} completed with exit code ${code} (warnings or non-critical notices may have occurred).`);
    }
  });
}

if (require.main === module) {
  runRestore().catch((err) => {
    console.error('[FATAL]', err);
    process.exit(1);
  });
}

module.exports = { parseArgs };
