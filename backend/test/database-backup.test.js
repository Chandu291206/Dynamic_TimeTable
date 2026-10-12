const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { parseArgs, formatDate, enforceRetention } = require('../scripts/db-backup');
const { findLatestBackup, verifySqlDump, REQUIRED_TABLES } = require('../scripts/verify-backup');

test('Backup Strategy: formatDate generates valid YYYYMMDD_HHmmss format', () => {
  const sampleDate = new Date(2026, 9, 8, 14, 30, 45); // Month is 0-indexed: 9 = October
  const formatted = formatDate(sampleDate);
  assert.equal(formatted, '20261008_143045');
  assert.match(formatted, /^\d{8}_\d{6}$/);
});

test('Backup Strategy: parseArgs defaults to custom format, 14-day retention', () => {
  const originalArgv = process.argv;
  try {
    process.argv = ['node', 'scripts/db-backup.js'];
    const opts = parseArgs();
    assert.equal(opts.format, 'custom');
    assert.equal(opts.retentionDays, 14);
    assert.equal(opts.schema, '');
  } finally {
    process.argv = originalArgv;
  }
});

test('Backup Strategy: parseArgs accepts custom flags for sql format, schema, retention, dir', () => {
  const originalArgv = process.argv;
  try {
    process.argv = [
      'node',
      'scripts/db-backup.js',
      '--format=sql',
      '--schema=public',
      '--retention=30',
      '--dir=./custom-backups',
    ];
    const opts = parseArgs();
    assert.equal(opts.format, 'plain');
    assert.equal(opts.schema, 'public');
    assert.equal(opts.retentionDays, 30);
    assert.ok(opts.backupDir.endsWith('custom-backups'));
  } finally {
    process.argv = originalArgv;
  }
});

test('Backup Strategy: enforceRetention purges expired backups while preserving active ones', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-test-'));

  try {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // Create a recent backup (1 day old)
    const recentDump = path.join(tempDir, 'timetable_backup_20261007_120000.dump');
    fs.writeFileSync(recentDump, 'recent dump content');
    const recentTime = (now - 1 * dayMs) / 1000;
    fs.utimesSync(recentDump, recentTime, recentTime);

    // Create a recent sql backup (2 days old)
    const recentSql = path.join(tempDir, 'timetable_backup_20261006_120000.sql');
    fs.writeFileSync(recentSql, 'recent sql content');
    const recentSqlTime = (now - 2 * dayMs) / 1000;
    fs.utimesSync(recentSql, recentSqlTime, recentSqlTime);

    // Create an expired backup (20 days old)
    const oldDump = path.join(tempDir, 'timetable_backup_20260918_120000.dump');
    fs.writeFileSync(oldDump, 'old dump content');
    const oldTime = (now - 20 * dayMs) / 1000;
    fs.utimesSync(oldDump, oldTime, oldTime);

    // Create an expired sql backup (25 days old)
    const oldSql = path.join(tempDir, 'timetable_backup_20260913_120000.sql');
    fs.writeFileSync(oldSql, 'old sql content');
    const oldSqlTime = (now - 25 * dayMs) / 1000;
    fs.utimesSync(oldSql, oldSqlTime, oldSqlTime);

    // Create an unrelated file that should not be touched
    const otherFile = path.join(tempDir, 'notes.txt');
    fs.writeFileSync(otherFile, 'do not delete');

    // Run retention enforcement with 14 days
    enforceRetention(tempDir, 14);

    // Verify
    assert.equal(fs.existsSync(recentDump), true, 'Recent dump should be preserved');
    assert.equal(fs.existsSync(recentSql), true, 'Recent sql should be preserved');
    assert.equal(fs.existsSync(otherFile), true, 'Unrelated files should be preserved');
    assert.equal(fs.existsSync(oldDump), false, 'Expired dump should be purged');
    assert.equal(fs.existsSync(oldSql), false, 'Expired sql should be purged');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Backup Strategy: findLatestBackup returns newest backup in directory', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-latest-test-'));

  try {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const file1 = path.join(tempDir, 'timetable_backup_20261001_100000.dump');
    fs.writeFileSync(file1, 'data 1');
    fs.utimesSync(file1, (now - 5 * dayMs) / 1000, (now - 5 * dayMs) / 1000);

    const file2 = path.join(tempDir, 'timetable_backup_20261005_100000.sql');
    fs.writeFileSync(file2, 'data 2');
    fs.utimesSync(file2, (now - 1 * dayMs) / 1000, (now - 1 * dayMs) / 1000);

    const latest = findLatestBackup(tempDir);
    assert.ok(latest);
    assert.equal(latest.name, 'timetable_backup_20261005_100000.sql');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Backup Strategy: verifySqlDump identifies complete vs missing schemas', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-verify-test-'));

  try {
    const validSqlPath = path.join(tempDir, 'valid.sql');
    const validContent = `
      CREATE TABLE public."ClassRoom" (id serial);
      CREATE TABLE public."TimetableSlot" (id serial);
      CREATE TABLE public."TimetableOverride" (id serial);
      CREATE TABLE public."Faculty" (id serial);
      CREATE TABLE public."Subject" (id serial);
      CREATE TABLE public."User" (id serial);
    `;
    fs.writeFileSync(validSqlPath, validContent);

    const validResult = verifySqlDump(validSqlPath);
    assert.equal(validResult.valid, true);
    assert.equal(validResult.foundTables.length, REQUIRED_TABLES.length);
    assert.equal(validResult.missingTables.length, 0);

    const incompleteSqlPath = path.join(tempDir, 'incomplete.sql');
    const incompleteContent = `
      CREATE TABLE public."ClassRoom" (id serial);
      CREATE TABLE public."Faculty" (id serial);
    `;
    fs.writeFileSync(incompleteSqlPath, incompleteContent);

    const incompleteResult = verifySqlDump(incompleteSqlPath);
    assert.equal(incompleteResult.valid, false);
    assert.ok(incompleteResult.missingTables.includes('TimetableSlot'));
    assert.ok(incompleteResult.missingTables.includes('TimetableOverride'));
    assert.ok(incompleteResult.missingTables.includes('Subject'));
    assert.ok(incompleteResult.missingTables.includes('User'));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
