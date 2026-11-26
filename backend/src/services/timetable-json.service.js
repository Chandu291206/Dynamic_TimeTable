const prisma = require('../config/database');
const { timetableJsonSchema } = require('../validators/timetable-json.schema');
const { normalizeStaffId, normalizeSubjectCode } = require('../utils/identity');
const { resolvePeriodsFromList } = require('../utils/period-resolver');
const { assertNoClashes, ClashError } = require('./clash.service');
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
  if (/(?:^|\b)(?:iv|4th|4)(?:\b|$)/i.test(semLower) || semLower.includes('iv year') || semLower.includes('year 4') || semLower.includes('year iv')) {
    year = 4;
  } else if (/(?:^|\b)(?:iii|3rd|3)(?:\b|$)/i.test(semLower) || semLower.includes('iii year') || semLower.includes('year 3') || semLower.includes('year iii')) {
    year = 3;
  } else if (/(?:^|\b)(?:ii|2nd|2)(?:\b|$)/i.test(semLower) || semLower.includes('ii year') || semLower.includes('year 2') || semLower.includes('year ii')) {
    year = 2;
  } else if (/(?:^|\b)(?:i|1st|1)(?:\b|$)/i.test(semLower) || semLower.includes('i year') || semLower.includes('year 1') || semLower.includes('year i')) {
    year = 1;
  }

  let str = (branchStr || '').trim();
  // Strip degree prefixes like "B.Tech", "B.Tech.", "BTech"
  str = str.replace(/^B\.?\s*Tech\.?\s+/i, '').trim();

  let branch = str;
  let section = 'A';

  // Match pattern: <branch> [-/–] (Section|Sec) <sec> OR <branch> (Section|Sec) <sec>
  const secRegex = /^(.*?)\s*(?:[-–]\s*)?(?:Section|Sec)\s*([A-Za-z0-9]+)$/i;
  const match = str.match(secRegex);
  if (match) {
    branch = match[1].replace(/[-–\s]+$/, '').trim() || 'CSE';
    section = match[2].trim().toUpperCase();
  } else {
    const parts = str.split(/\s+/);
    if (parts.length > 1) {
      branch = parts[0];
      section = parts.slice(1).join(' ').replace(/^[-–]\s*/, '').trim() || 'A';
    } else {
      branch = str || 'CSE';
      section = 'A';
    }
  }

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

  const academicYear = (json.academic_year || '2026-27').trim();

  // 1. Upsert ClassRoom with full metadata
  const classRoom = await db.classRoom.upsert({
    where: {
      year_branch_section_academicYear: {
        year,
        branch,
        section,
        academicYear,
      },
    },
    update: {
      academicYear,
      semester: json.semester,
      effectiveFrom: json.effective_from,
      metadata: json,
    },
    create: {
      year,
      branch,
      section,
      academicYear,
      semester: json.semester,
      effectiveFrom: json.effective_from,
      metadata: json,
    },
  });

  // 2. Process Courses and Faculty
  const subjectMap = new Map(); // code/shortform/name -> { subject, facultyId, batchBFacultyId }

  for (const course of json.courses || []) {
    let facultyId = null;
    let batchBFacultyId = null;

    // Handle faculty assignment
    let primaryFacultyName = '';
    let primaryStaffId = course.staff_id || null;
    let secondaryFacultyName = '';
    let secondaryStaffId = course.batch_b_staff_id || null;

    if (Array.isArray(course.faculty) && course.faculty.length > 0) {
      primaryFacultyName = course.faculty[0].name || '';
      if (!primaryStaffId && course.faculty[0].staff_id) {
        primaryStaffId = course.faculty[0].staff_id;
      }
      if (course.faculty.length > 1) {
        secondaryFacultyName = course.faculty[1].name || '';
        if (!secondaryStaffId && course.faculty[1].staff_id) {
          secondaryStaffId = course.faculty[1].staff_id;
        }
      }
    } else if (typeof course.faculty === 'string' && course.faculty.trim()) {
      primaryFacultyName = course.faculty.trim();
    }

    // Resolve primary faculty by staffId ONLY
    if (primaryStaffId) {
      const cleanStaffId = normalizeStaffId(primaryStaffId);
      let facultyRecord = await db.faculty.findUnique({
        where: { staffId: cleanStaffId },
      });
      if (!facultyRecord && primaryFacultyName) {
        facultyRecord = await db.faculty.create({
          data: {
            staffId: cleanStaffId,
            name: primaryFacultyName,
            department: branch,
            designation: 'Faculty',
          },
        });
      }
      if (facultyRecord) {
        facultyId = facultyRecord.id;
      }
    }

    // Resolve Batch B faculty by staffId ONLY
    if (secondaryStaffId) {
      const cleanStaffIdB = normalizeStaffId(secondaryStaffId);
      let facultyRecordB = await db.faculty.findUnique({
        where: { staffId: cleanStaffIdB },
      });
      if (!facultyRecordB && secondaryFacultyName) {
        facultyRecordB = await db.faculty.create({
          data: {
            staffId: cleanStaffIdB,
            name: secondaryFacultyName,
            department: branch,
            designation: 'Faculty',
          },
        });
      }
      if (facultyRecordB) {
        batchBFacultyId = facultyRecordB.id;
      }
    }

    // Upsert Subject using shortform or name as the primary reference code (not regulation code)
    const primaryCode = normalizeSubjectCode(course.shortform || course.course_name || course.course_code);
    const subjectName = (course.course_name || course.shortform || primaryCode).trim();
    const isBreak = Boolean(course.is_break || primaryCode === 'LUNCH');

    const subjectRecord = await db.subject.upsert({
      where: { code: primaryCode },
      update: {
        name: subjectName,
        isBreak,
      },
      create: {
        code: primaryCode,
        name: subjectName,
        isBreak,
      },
    });

    const mapping = {
      subject: subjectRecord,
      facultyId,
      batchBFacultyId,
    };

    subjectMap.set(primaryCode, mapping);
    if (course.shortform) {
      const sf = course.shortform.trim().toUpperCase();
      subjectMap.set(sf, mapping);

      // Handle elective aliases: PE-I <-> PE-1, OE-I <-> OE-1, etc.
      const romanArabicMap = [
        ['PE-I', 'PE-1'], ['PE-II', 'PE-2'], ['PE-III', 'PE-3'], ['PE-IV', 'PE-4'],
        ['OE-I', 'OE-1'], ['OE-II', 'OE-2'], ['OE-III', 'OE-3'], ['OE-IV', 'OE-4'],
      ];
      for (const [roman, arabic] of romanArabicMap) {
        if (sf === roman || sf === arabic) {
          subjectMap.set(roman, mapping);
          subjectMap.set(arabic, mapping);
        }
      }

      // Handle parenthetical elective forms like "CC (PE-I)" or "NNDL (PE-III)"
      const parenMatch = sf.match(/^(.+?)\s*\(([^)]+)\)$/);
      if (parenMatch) {
        const baseName = parenMatch[1].trim();
        const electiveTag = parenMatch[2].trim();
        subjectMap.set(baseName, mapping);
        subjectMap.set(electiveTag, mapping);
        for (const [roman, arabic] of romanArabicMap) {
          if (electiveTag === roman || electiveTag === arabic) {
            subjectMap.set(roman, mapping);
            subjectMap.set(arabic, mapping);
          }
        }
      }
    }
    if (course.course_name) {
      subjectMap.set(course.course_name.trim().toUpperCase(), mapping);
    }
    if (course.course_code) {
      subjectMap.set(course.course_code.trim().toUpperCase(), mapping);
    }
  }

  // Ensure break/LUNCH subject exists
  let lunchSubject = await db.subject.findFirst({ where: { isBreak: true } });
  if (!lunchSubject) {
    lunchSubject = await db.subject.findUnique({ where: { code: 'LUNCH' } });
  }
  if (!lunchSubject) {
    lunchSubject = await db.subject.create({
      data: { code: 'LUNCH', name: 'Lunch Break', isBreak: true },
    });
  }
  subjectMap.set('LUNCH', { subject: lunchSubject, facultyId: null, batchBFacultyId: null });

  // 3. Build candidate slots for the timetable
  const activePeriods = await db.period.findMany({ orderBy: { order: 'asc' } });
  const candidateSlots = [];
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
      let batchBFacultyId = null;

      if (subjectMap.has(subjectKey)) {
        const found = subjectMap.get(subjectKey);
        subjectId = found.subject?.id || null;
        facultyId = found.facultyId || null;
        batchBFacultyId = found.batchBFacultyId || null;
      } else if (item.subject) {
        // Create new subject by code if not previously listed
        const code = normalizeSubjectCode(item.subject.trim());
        const isBreak = code === 'LUNCH';
        const newSub = await db.subject.upsert({
          where: { code },
          update: {},
          create: {
            code,
            name: item.subject.trim(),
            isBreak,
          },
        });
        subjectId = newSub.id;
      }

      const { startPeriodId, endPeriodId } = resolvePeriodsFromList(startTime, endTime, activePeriods);

      candidateSlots.push({
        classId: classRoom.id,
        day: dayIndex,
        startTime,
        endTime,
        room: item.room || null,
        startPeriodId,
        endPeriodId,
        subjectId,
        facultyId,
        batchBFacultyId,
      });
    }
  }

  // 4. Validate clash prevention across candidate slots and against other classes
  if (options.checkClashes !== false) {
    const otherSlots = await db.timetableSlot.findMany({
      where: { classId: { not: classRoom.id } },
      include: { class: true, subject: true, faculty: true, batchBFaculty: true },
    });
    assertNoClashes({
      candidateSlots,
      existingSlots: otherSlots,
    });
  }

  // 5. Delete existing slots for this class and insert verified candidate slots
  await db.timetableSlot.deleteMany({
    where: { classId: classRoom.id },
  });

  for (const slotData of candidateSlots) {
    await db.timetableSlot.create({
      data: slotData,
    });
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
        include: { subject: true, faculty: true, startPeriod: true, endPeriod: true },
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
      let periodsArr = undefined;
      if (slot.startPeriod && slot.endPeriod) {
        const startOrder = slot.startPeriod.order;
        const endOrder = slot.endPeriod.order;
        if (startOrder <= endOrder) {
          periodsArr = [];
          for (let o = startOrder; o <= endOrder; o++) {
            periodsArr.push(o);
          }
        }
      }

      return {
        time: `${slot.startTime}-${slot.endTime}`,
        ...(periodsArr && periodsArr.length > 0 ? { periods: periodsArr } : {}),
        ...(slot.room ? { room: slot.room } : {}),
        subject: slot.subject?.code || slot.subject?.name || '---',
      };
    });
  }

  // Build courses map
  const coursesMap = new Map();
  for (const slot of classRoom.slots || []) {
    if (!slot.subject || slot.subject.isBreak || slot.subject.code === 'LUNCH') continue;
    const name = slot.subject.name;
    if (!coursesMap.has(name)) {
      coursesMap.set(name, {
        course_code: slot.subject.code || name,
        shortform: slot.subject.code || name,
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
