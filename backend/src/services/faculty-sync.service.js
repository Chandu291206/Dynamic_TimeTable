const pdf = require('pdf-parse');
const prisma = require('../config/database');
const { grietFacultySourceUrl } = require('../config/env');

function isOfficialGrietUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'griet.ac.in' || url.hostname.endsWith('.griet.ac.in'));
  } catch {
    return false;
  }
}

function parseFacultyPdf(text) {
  const records = [];
  const linePattern = /^\d+\s+(.+?)\s+(\d{2,})\s+(.+?)\s+(Professor|Associate\s+Prof(?:essor)?|Asst\.?\s*Professor)(?:\s|$)/i;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, ' ').trim();
    const match = line.match(linePattern);
    if (!match) continue;
    const [, name, staffId, qualification, designation] = match;
    records.push({ name: name.trim(), staffId: staffId.trim(), qualification: qualification.trim(), designation: designation.trim() });
  }
  return [...new Map(records.map((record) => [record.staffId, record])).values()];
}

async function runFacultySync() {
  const sourceUrl = grietFacultySourceUrl;
  if (!isOfficialGrietUrl(sourceUrl)) throw new Error('Faculty source URL must be an official HTTPS GRIET URL');
  const run = await prisma.facultySyncRun.create({ data: { status: 'RUNNING', sourceUrl } });
  const counts = { created: 0, updated: 0, unchanged: 0, failed: 0, skipped: 0 };

  try {
    const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(30000), headers: { 'user-agent': 'Timetable-Management-System/1.0' } });
    if (!response.ok) throw new Error(`Official source returned HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > 15 * 1024 * 1024) throw new Error('Official faculty PDF exceeds the 15 MB safety limit');
    const parsed = await pdf(buffer);
    const records = parseFacultyPdf(parsed.text);
    if (!records.length) throw new Error('No faculty records could be parsed from the official PDF');

    for (const record of records) {
      try {
        const existing = await prisma.faculty.findUnique({ where: { staffId: record.staffId } });
        const data = { ...record, profileSourceUrl: sourceUrl, lastScrapedAt: new Date() };
        if (!existing) {
          await prisma.faculty.create({ data });
          counts.created += 1;
        } else if (existing.name === record.name && existing.qualification === record.qualification && existing.designation === record.designation && existing.profileSourceUrl === sourceUrl) {
          await prisma.faculty.update({ where: { id: existing.id }, data: { lastScrapedAt: new Date() } });
          counts.unchanged += 1;
        } else {
          await prisma.faculty.update({ where: { id: existing.id }, data });
          counts.updated += 1;
        }
      } catch {
        counts.failed += 1;
      }
    }
    return prisma.facultySyncRun.update({ where: { id: run.id }, data: { status: 'COMPLETED', ...counts, finishedAt: new Date() } });
  } catch (error) {
    await prisma.facultySyncRun.update({ where: { id: run.id }, data: { status: 'FAILED', ...counts, error: error.message, finishedAt: new Date() } });
    throw error;
  }
}

async function getLatestSyncRun() {
  return prisma.facultySyncRun.findFirst({ orderBy: { startedAt: 'desc' } });
}

module.exports = { runFacultySync, getLatestSyncRun, parseFacultyPdf, isOfficialGrietUrl };
