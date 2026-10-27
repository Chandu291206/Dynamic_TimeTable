const prisma = require('../config/database');

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function dayNumberToName(dayNum) {
  if (dayNum === null || dayNum === undefined) return null;
  if (typeof dayNum === 'string') return dayNum;
  return DAY_NAMES[dayNum] || `Day ${dayNum}`;
}

async function recordLog({
  action,
  performedBy,
  year = null,
  branch = null,
  section = null,
  day = null,
  date = null,
  details = null,
}) {
  try {
    const dayStr = typeof day === 'number' ? dayNumberToName(day) : (day || null);
    await prisma.$executeRawUnsafe(
      `INSERT INTO "TimetableLog" ("action", "performedBy", "year", "branch", "section", "day", "date", "details", "timestamp")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      action || 'TIMETABLE_UPDATE',
      performedBy || 'Administrator',
      year ? parseInt(year, 10) : null,
      branch ? String(branch) : null,
      section ? String(section) : null,
      dayStr,
      date ? String(date) : null,
      details || null
    );
  } catch (err) {
    console.error('Failed to record timetable log:', err.message);
  }
}

async function getLogs({ limit = 150, offset = 0 } = {}) {
  try {
    const logs = await prisma.$queryRawUnsafe(
      `SELECT "id", "action", "performedBy", "year", "branch", "section", "day", "date", "details", "timestamp"
       FROM "TimetableLog"
       ORDER BY "timestamp" DESC
       LIMIT $1 OFFSET $2`,
      limit,
      offset
    );
    return logs;
  } catch (err) {
    console.error('Failed to fetch timetable logs:', err.message);
    return [];
  }
}

module.exports = {
  recordLog,
  getLogs,
  dayNumberToName,
};
