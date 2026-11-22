const pdf = require('pdf-parse');
const prisma = require('../config/database');
const { grietFacultySourceUrl } = require('../config/env');
const { normalizeStaffId } = require('../utils/identity');
const logger = require('../utils/logger');

function isOfficialGrietUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'griet.ac.in' || url.hostname.endsWith('.griet.ac.in'));
  } catch {
    return false;
  }
}

/**
 * Parses faculty records from raw text extracted from the official PDF.
 * Enforces Goal G1:
 * - staffId is mandatory and normalized.
 * - Rows missing staffId are skipped and collected in `issues` (`missing_staff_id`).
 * - Duplicate staffIds in the same source feed cause BOTH rows to be skipped and logged (`duplicate_staff_id_in_source`).
 *
 * @param {string} text - Raw text extracted from PDF
 * @returns {Array<object>} validRecords with `.issues` and `.skippedCount` properties
 */
function parseFacultyPdf(text) {
  const issues = [];
  let skippedCount = 0;
  const candidateRecords = [];

  const linePattern = /^\s*(\d+)\s+([A-Za-z.\s'-]+?)\s+(\d{2,})\s+([A-Za-z0-9,.\s()/-]+?)\s+((?:Professor|Associate\s+Prof(?:essor)?|Asst\.?\s*Professor|Lecturer|Dean|Director|HOD)(?:\s+.*)?)$/i;
  const candidateMissingStaffPattern = /^\s*(\d+)\s+([A-Za-z.\s'-]+?)\s+(Professor|Associate\s+Prof(?:essor)?|Asst\.?\s*Professor|Lecturer|Dean|Director|HOD)(?:\s+.*)?$/i;

  const lines = (text || '').split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+/g, ' ').trim();
    if (!line) continue;

    const match = line.match(linePattern);
    if (match) {
      const [, , name, rawStaffId, qualification, designation] = match;
      const cleanStaffId = normalizeStaffId(rawStaffId);

      if (!cleanStaffId) {
        issues.push({
          type: 'missing_staff_id',
          name: name.trim(),
          rawRow: line,
          reason: 'Staff ID could not be normalized',
        });
        skippedCount += 1;
        continue;
      }

      candidateRecords.push({
        staffId: cleanStaffId,
        name: name.trim(),
        department: null,
        designation: designation.trim(),
        qualification: qualification.trim(),
        email: null,
        profileUrl: null,
        imageUrl: null,
        rawRow: line,
      });
      continue;
    }

    // Check if line looks like a faculty row but lacks numeric staffId
    const missingMatch = line.match(candidateMissingStaffPattern);
    if (missingMatch) {
      const [, , name] = missingMatch;
      issues.push({
        type: 'missing_staff_id',
        name: name.trim(),
        rawRow: line,
        reason: 'Line matched faculty pattern but had no valid staffId',
      });
      skippedCount += 1;
    }
  }

  // Count occurrences of each staffId to detect duplicates within source
  const staffCounts = new Map();
  for (const rec of candidateRecords) {
    staffCounts.set(rec.staffId, (staffCounts.get(rec.staffId) || 0) + 1);
  }

  const validRecords = [];
  for (const rec of candidateRecords) {
    const count = staffCounts.get(rec.staffId);
    if (count > 1) {
      issues.push({
        type: 'duplicate_staff_id_in_source',
        staffId: rec.staffId,
        name: rec.name,
        rawRow: rec.rawRow,
        reason: `Duplicate staffId '${rec.staffId}' found ${count} times in source feed`,
      });
      skippedCount += 1;
    } else {
      const { rawRow, ...cleanRecord } = rec;
      validRecords.push(cleanRecord);
    }
  }

  validRecords.issues = issues;
  validRecords.skippedCount = skippedCount;
  return validRecords;
}

function parseFacultyPdfDetailed(text) {
  const records = parseFacultyPdf(text);
  return {
    records: [...records],
    issues: records.issues || [],
    skippedCount: records.skippedCount || 0,
  };
}

/**
 * Executes a faculty synchronization run against the official PDF source.
 * Supports injected options for deterministic unit testing without live network calls.
 *
 * @param {object} [options]
 * @param {string} [options.sourceUrl]
 * @param {string} [options.pdfText] - Raw pre-parsed text (bypasses network & pdf-parse)
 * @param {Buffer} [options.pdfBuffer] - Pre-downloaded PDF buffer
 * @param {Function} [options.fetchFn] - Custom fetch implementation
 * @param {object} [options.prismaClient] - Database client instance
 */
async function runFacultySync(options = {}) {
  const db = options.prismaClient || prisma;
  const customFetch = options.fetchFn || globalThis.fetch;
  const sourceUrl = options.sourceUrl || grietFacultySourceUrl;

  if (!options.pdfText && !isOfficialGrietUrl(sourceUrl)) {
    throw new Error('Faculty source URL must be an official HTTPS GRIET URL');
  }

  const run = await db.facultySyncRun.create({
    data: { status: 'RUNNING', sourceUrl: sourceUrl || 'https://www.griet.ac.in/' },
  });

  const counts = { created: 0, updated: 0, unchanged: 0, failed: 0, skipped: 0 };
  const issues = [];

  try {
    let text = options.pdfText;

    if (!text) {
      let buffer = options.pdfBuffer;
      if (!buffer) {
        const response = await customFetch(sourceUrl, {
          signal: AbortSignal.timeout(30000),
          headers: { 'user-agent': 'Timetable-Management-System/1.0' },
        });
        if (!response.ok) {
          throw new Error(`Official source returned HTTP ${response.status}`);
        }
        buffer = Buffer.from(await response.arrayBuffer());
      }

      if (buffer.length > 15 * 1024 * 1024) {
        throw new Error('Official faculty PDF exceeds the 15 MB safety limit');
      }

      const parsed = await pdf(buffer);
      text = parsed.text;
    }

    const records = parseFacultyPdf(text);
    if (records.issues && records.issues.length > 0) {
      issues.push(...records.issues);
    }
    counts.skipped += records.skippedCount || 0;

    if (!records.length && counts.skipped === 0) {
      throw new Error('No faculty records could be parsed from the official PDF');
    }

    for (const record of records) {
      try {
        // Strict lookup by staffId ONLY. NEVER look up by name.
        const existing = await db.faculty.findUnique({ where: { staffId: record.staffId } });
        const defaultProfileUrl = record.profileUrl || sourceUrl;

        if (!existing) {
          await db.faculty.create({
            data: {
              staffId: record.staffId,
              name: record.name,
              department: record.department || null,
              designation: record.designation || null,
              qualification: record.qualification || null,
              email: record.email || null,
              profileSourceUrl: defaultProfileUrl,
              imageSourceUrl: record.imageUrl || null,
              lastScrapedAt: new Date(),
              isActive: true,
            },
          });
          counts.created += 1;
        } else {
          // Check for changed fields
          let hasChanges = false;
          const updateData = { lastScrapedAt: new Date() };

          if (record.name && existing.name !== record.name) {
            updateData.name = record.name;
            hasChanges = true;
          }
          if (record.department && existing.department !== record.department) {
            updateData.department = record.department;
            hasChanges = true;
          }
          if (record.designation && existing.designation !== record.designation) {
            updateData.designation = record.designation;
            hasChanges = true;
          }
          if (record.qualification && existing.qualification !== record.qualification) {
            updateData.qualification = record.qualification;
            hasChanges = true;
          }
          if (record.email && existing.email !== record.email) {
            updateData.email = record.email;
            hasChanges = true;
          }
          if (record.profileUrl && existing.profileSourceUrl !== record.profileUrl) {
            updateData.profileSourceUrl = record.profileUrl;
            hasChanges = true;
          }
          if (record.imageUrl && existing.imageSourceUrl !== record.imageUrl) {
            updateData.imageSourceUrl = record.imageUrl;
            hasChanges = true;
          }

          if (hasChanges) {
            await db.faculty.update({ where: { id: existing.id }, data: updateData });
            counts.updated += 1;
          } else {
            await db.faculty.update({ where: { id: existing.id }, data: { lastScrapedAt: new Date() } });
            counts.unchanged += 1;
          }
        }
      } catch (err) {
        counts.failed += 1;
        issues.push({
          type: 'fetch_failed',
          staffId: record.staffId,
          name: record.name,
          error: err.message,
        });
      }
    }

    return await db.facultySyncRun.update({
      where: { id: run.id },
      data: {
        status: 'COMPLETED',
        ...counts,
        issues: issues.length > 0 ? issues : null,
        finishedAt: new Date(),
      },
    });
  } catch (error) {
    logger.error('Faculty synchronization failed:', error);
    await db.facultySyncRun.update({
      where: { id: run.id },
      data: {
        status: 'FAILED',
        ...counts,
        issues: issues.length > 0 ? issues : null,
        error: error.message,
        finishedAt: new Date(),
      },
    });
    throw error;
  }
}

async function getLatestSyncRun() {
  return prisma.facultySyncRun.findFirst({ orderBy: { startedAt: 'desc' } });
}

module.exports = {
  runFacultySync,
  getLatestSyncRun,
  parseFacultyPdf,
  parseFacultyPdfDetailed,
  isOfficialGrietUrl,
};
