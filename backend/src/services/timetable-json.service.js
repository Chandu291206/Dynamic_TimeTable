const prisma = require('../config/database');
const { timetableJsonSchema } = require('../validators/timetable-json.schema');
const logger = require('../utils/logger');

const DAY_MAP = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
};

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseClassInfo(semesterStr, branchStr) {
  let year = 1;
  const semLower = (semesterStr || '').toLowerCase();
  if (semLower.includes('iv') || semLower.includes('4th') || semLower.includes('4 year')) {
    year = 4;
  } else if (semLower.includes('iii') || semLower.includes('3rd') || semLower.includes('3 year')) {
    year = 3;
  } else if (semLower.includes('ii') || semLower.includes('2nd') || semLower.includes('2 year')) {
    year = 2;
  } else if (semLower.includes('i') || semLower.includes('1st') || semLower.includes('1 year')) {
    year = 1;
  }

  // Branch and Section separation (e.g. "CSE I" -> branch: "CSE", section: "I")
  const parts = (branchStr || '').trim().split(/\s+/);
  let branch = parts[0] || 'CSE';
  let section = parts.slice(1).join(' ') || 'A';
  if (!section) section = 'A';

  return { year, branch, section };
}

function normalizeTime(t) {
  if (!t) return '';
  const trimmed = t.trim();
  const [h, m] = trimmed.split(':');
  if (!h || !m) return trimmed;
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
}

async function validateTimetableJson(rawJson) {
  return timetableJsonSchema.safeParse(rawJson);
}

async function importTimetableJson(rawJson, { db = prisma } = {}) {
  const parsed = timetableJsonSchema.safeParse(rawJson);
  if (!parsed.success) {
    const error = new Error('Invalid timetable JSON structure');
    error.validationErrors = parsed.error.flatten();
    throw error;
  }

  const json = parsed.data;
  const { year, branch, section } = parseClassInfo(json.semester, json.branch);

  // 1. Upsert ClassRoom with full metadata
  const classRoom = await db.classRoom.upsert({
    where: {
      year_branch_section: {
        year,
        branch,
        section,
      },
    },
    update: {
      academicYear: json.academic_year,
      semester: json.semester,
      effectiveFrom: json.effective_from,
      metadata: json,
    },
    create: {
      year,
      branch,
      section,
      academicYear: json.academic_year,
      semester: json.semester,
      effectiveFrom: json.effective_from,
      metadata: json,
    },
  });

  // 2. Process Courses and Faculty
  const subjectMap = new Map(); // shortform/name -> { subject, facultyId }

  for (const course of json.courses || []) {
    let facultyId = null;

    // Handle faculty assignment
    let primaryFacultyName = '';
    let primaryStaffId = course.staff_id || null;

    if (Array.isArray(course.faculty) && course.faculty.length > 0) {
      primaryFacultyName = course.faculty[0].name;
      if (!primaryStaffId && course.faculty[0].staff_id) {
        primaryStaffId = course.faculty[0].staff_id;
      }
    } else if (typeof course.faculty === 'string' && course.faculty.trim()) {
      primaryFacultyName = course.faculty.trim();
    }

    if (primaryFacultyName) {
      // Find or create faculty by staffId or name
      let facultyRecord = null;
      if (primaryStaffId) {
        facultyRecord = await db.faculty.findUnique({
          where: { staffId: primaryStaffId },
        });
      }
      if (!facultyRecord) {
        facultyRecord = await db.faculty.findFirst({
          where: { name: primaryFacultyName },
        });
      }
      if (!facultyRecord) {
        facultyRecord = await db.faculty.create({
          data: {
            name: primaryFacultyName,
            staffId: primaryStaffId || undefined,
            department: branch,
            designation: 'Faculty',
          },
        });
      }
      facultyId = facultyRecord.id;
    }

    // Upsert Subject
    const subjectName = (course.shortform || course.course_name).trim();
    const subjectRecord = await db.subject.upsert({
      where: { name: subjectName },
      update: {
        code: course.course_code,
        shortform: course.shortform,
      },
      create: {
        name: subjectName,
        code: course.course_code,
        shortform: course.shortform,
      },
    });

    subjectMap.set(subjectName.toUpperCase(), {
      subject: subjectRecord,
      facultyId,
    });
    if (course.course_name) {
      subjectMap.set(course.course_name.trim().toUpperCase(), {
        subject: subjectRecord,
        facultyId,
      });
    }
  }

  // Ensure LUNCH subject exists
  let lunchSubject = await db.subject.findUnique({ where: { name: 'LUNCH' } });
  if (!lunchSubject) {
    lunchSubject = await db.subject.create({
      data: { name: 'LUNCH', shortform: 'LUNCH' },
    });
  }
  subjectMap.set('LUNCH', { subject: lunchSubject, facultyId: null });

  // 3. Delete existing recurring slots for this class to allow clean replacement
  await db.timetableSlot.deleteMany({
    where: { classId: classRoom.id },
  });

  // 4. Populate TimetableSlots for each day
  for (const [dayName, items] of Object.entries(json.timetable || {})) {
    const dayIndex = DAY_MAP[dayName.toLowerCase()];
    if (dayIndex === undefined) continue;

    for (const item of items) {
      const times = (item.time || '').split('-');
      if (times.length !== 2) continue;

      const startTime = normalizeTime(times[0]);
      const endTime = normalizeTime(times[1]);
      if (!startTime || !endTime) continue;

      const subjectKey = (item.subject || '').trim().toUpperCase();
      let subjectId = null;
      let facultyId = null;

      if (subjectMap.has(subjectKey)) {
        const found = subjectMap.get(subjectKey);
        subjectId = found.subject?.id || null;
        facultyId = found.facultyId || null;
      } else if (item.subject) {
        // Create new subject if not previously listed
        const newSub = await db.subject.upsert({
          where: { name: item.subject.trim() },
          update: {},
          create: { name: item.subject.trim(), shortform: item.subject.trim() },
        });
        subjectId = newSub.id;
      }

      const periodsStr = item.periods && item.periods.length > 0 ? item.periods.join(',') : null;

      await db.timetableSlot.create({
        data: {
          classId: classRoom.id,
          day: dayIndex,
          startTime,
          endTime,
          periods: periodsStr,
          subjectId,
          facultyId,
        },
      });
    }
  }

  const result = {
    classRoom,
    importedSlotsCount: await db.timetableSlot.count({ where: { classId: classRoom.id } }),
  };

  try {
    const facultyWebScraper = require('./faculty-web-scraper.service');
    facultyWebScraper.scrapeAndUpdateFaculty().catch((err) => {
      logger.warn(`Background faculty web scraping failed: ${err.message}`);
    });
  } catch (err) {
    logger.warn(`Could not trigger web scraper: ${err.message}`);
  }

  return result;
}

async function exportTimetableJson(classId, { db = prisma } = {}) {
  const classRoom = await db.classRoom.findUnique({
    where: { id: classId },
    include: {
      slots: {
        orderBy: [{ day: 'asc' }, { startTime: 'asc' }],
        include: { subject: true, faculty: true },
      },
    },
  });

  if (!classRoom) return null;

  // If complete metadata already stored, return synced canonical JSON
  const meta = classRoom.metadata && typeof classRoom.metadata === 'object' ? classRoom.metadata : {};

  // Build working hours from metadata or default
  const workingHours = meta.working_hours || {
    periods: [
      { period: 1, time: '09:00-09:50' },
      { period: 2, time: '09:50-10:40' },
      { period: 3, time: '10:40-11:30' },
      { period: 4, time: '11:30-12:20' },
      { period: 5, time: '12:55-13:45' },
      { period: 6, time: '13:45-14:35' },
      { period: 7, time: '14:35-15:25' },
    ],
    lunch: '12:20-12:55',
  };

  // Build timetable map
  const timetableMap = {};
  for (let i = 0; i <= 5; i++) {
    const dayName = DAY_NAMES[i];
    const daySlots = (classRoom.slots || []).filter((s) => s.day === i);
    timetableMap[dayName] = daySlots.map((slot) => {
      const periodsArr = slot.periods
        ? slot.periods.split(',').map((p) => parseInt(p, 10)).filter((p) => !isNaN(p))
        : undefined;

      return {
        time: `${slot.startTime}-${slot.endTime}`,
        ...(periodsArr && periodsArr.length > 0 ? { periods: periodsArr } : {}),
        subject: slot.subject?.shortform || slot.subject?.name || '---',
      };
    });
  }

  // Build courses map
  const coursesMap = new Map();
  for (const slot of classRoom.slots || []) {
    if (!slot.subject || slot.subject.name.toUpperCase() === 'LUNCH') continue;
    const name = slot.subject.name;
    if (!coursesMap.has(name)) {
      coursesMap.set(name, {
        course_code: slot.subject.code || `GR24A${slot.subject.id.toString().padStart(4, '0')}`,
        shortform: slot.subject.shortform || name,
        course_name: name,
        faculty: slot.faculty?.name || 'TBA',
        staff_id: slot.faculty?.staffId || undefined,
      });
    }
  }

  return {
    academic_year: classRoom.academicYear || meta.academic_year || '2026-27',
    semester: classRoom.semester || meta.semester || `Year ${classRoom.year} Semester I`,
    branch: `${classRoom.branch} ${classRoom.section}`.trim(),
    effective_from: classRoom.effectiveFrom || meta.effective_from || '30-06-2026',
    classroom: meta.classroom || {
      theory: '1302',
      labs: {},
      class_coordinator: 'Faculty Coordinator',
      year_coordinator: 'Year Incharge',
    },
    working_hours: workingHours,
    timetable: timetableMap,
    courses: meta.courses && meta.courses.length > 0 ? meta.courses : Array.from(coursesMap.values()),
    academic_calendar: meta.academic_calendar || [],
  };
}

module.exports = {
  validateTimetableJson,
  importTimetableJson,
  exportTimetableJson,
  parseClassInfo,
};
