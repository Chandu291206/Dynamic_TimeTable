const prisma = require('../config/database');
const { getTimetableDay } = require('../utils/dates');
const { applyOverrides } = require('./override.service');
const { resolveSlotRoom } = require('../utils/room-resolver');

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function classLabel(classRoom) {
  return `Y${classRoom.year} - ${classRoom.branch} - ${classRoom.section}`;
}

function extractElectiveTag(text) {
  if (!text) return null;
  const m = String(text).match(/\b(PE|OE)\s*[-:]?\s*([0-9IVXLCDM]+|\bNPTEL\b)?/i);
  if (!m) return null;
  const type = m[1].toUpperCase();
  let num = (m[2] || '').trim().toUpperCase();
  const romanMap = { I: '1', II: '2', III: '3', IV: '4', V: '5', VI: '6' };
  if (romanMap[num]) num = romanMap[num];
  return num ? `${type}-${num}` : type;
}

function buildClassElectiveMap(metadata) {
  const map = new Map();
  const courses = metadata?.courses || [];
  for (const c of courses) {
    const tag = extractElectiveTag(c.shortform) || extractElectiveTag(c.course_name) || extractElectiveTag(c.course_code);
    if (tag) {
      if (c.shortform) map.set(c.shortform.trim().toUpperCase(), tag);
      if (c.course_name) map.set(c.course_name.trim().toUpperCase(), tag);
      const baseMatch = (c.shortform || '').match(/^([A-Za-z0-9_-]+)/);
      if (baseMatch) map.set(baseMatch[1].toUpperCase(), tag);
    }
  }
  return map;
}

function resolveElectiveTag(subject, electiveMap) {
  if (!subject) return null;
  const directTag = extractElectiveTag(subject.code) || extractElectiveTag(subject.name);
  if (directTag) return directTag;
  if (!electiveMap) return null;
  return electiveMap.get((subject.code || '').toUpperCase()) || electiveMap.get((subject.name || '').toUpperCase()) || null;
}

function buildClassCourseFallbackMap(metadata) {
  const map = new Map();
  const courses = metadata?.courses || [];
  for (const c of courses) {
    const tag = extractElectiveTag(c.shortform) || extractElectiveTag(c.course_name) || extractElectiveTag(c.course_code);
    const facultyInfo = typeof c.faculty === 'string'
      ? (c.faculty.trim() ? { name: c.faculty.trim(), staffId: c.staff_id || null } : null)
      : (Array.isArray(c.faculty) && c.faculty[0]?.name
        ? { name: c.faculty[0].name.trim(), staffId: c.faculty[0].staff_id || null }
        : null);

    const entry = {
      course_code: c.course_code || null,
      shortform: c.shortform || null,
      course_name: c.course_name || null,
      electiveTag: tag || null,
      facultyInfo,
    };

    const keys = new Set();
    if (c.shortform) keys.add(c.shortform.trim().toUpperCase());
    if (c.course_name) keys.add(c.course_name.trim().toUpperCase());
    if (c.course_code) keys.add(c.course_code.trim().toUpperCase());
    if (tag) {
      keys.add(tag);
      const baseType = tag.split('-')[0];
      if (baseType && !map.has(baseType)) keys.add(baseType);
    }
    for (const k of keys) {
      if (!map.has(k)) map.set(k, entry);
    }
  }
  return map;
}

function isGenericElectiveLabel(text) {
  if (!text) return false;
  return /^(PE|OE)(\s*[-:]?\s*([0-9IVXLCDM]+|NPTEL))?$/i.test(String(text).trim());
}

async function resolveFallbackFacultyMap(courseFallbackMap) {
  const staffIds = [];
  const names = [];
  for (const entry of courseFallbackMap.values()) {
    if (entry.facultyInfo?.staffId) staffIds.push(String(entry.facultyInfo.staffId).trim());
    if (entry.facultyInfo?.name) names.push(entry.facultyInfo.name.trim());
  }
  if (staffIds.length === 0 && names.length === 0) return new Map();

  const records = await prisma.faculty.findMany({
    where: {
      OR: [
        ...(staffIds.length > 0 ? [{ staffId: { in: staffIds } }] : []),
        ...(names.length > 0 ? [{ name: { in: names, mode: 'insensitive' } }] : []),
      ],
    },
  });

  const lookup = new Map();
  for (const r of records) {
    if (r.staffId) lookup.set(`id:${r.staffId.trim().toUpperCase()}`, r);
    if (r.name) lookup.set(`name:${r.name.trim().toLowerCase()}`, r);
  }
  return lookup;
}

function resolveSlotWithCourseFallback(slot, override, electiveMap, courseFallbackMap, facultyLookup) {
  const baseSubject = override ? override.subject : slot.subject;
  const baseFaculty = override ? override.faculty : slot.faculty;
  const baseBatchBFaculty = override ? override.batchBFaculty : slot.batchBFaculty;

  let subject = subjectPayload(baseSubject, electiveMap);
  let faculty = facultyPayload(baseFaculty);

  if (!override && baseSubject && (!baseFaculty || isGenericElectiveLabel(baseSubject.code) || isGenericElectiveLabel(baseSubject.name))) {
    const tag = resolveElectiveTag(baseSubject, electiveMap);
    const fallback =
      courseFallbackMap.get((baseSubject.code || '').trim().toUpperCase()) ||
      courseFallbackMap.get((baseSubject.name || '').trim().toUpperCase()) ||
      (tag ? courseFallbackMap.get(tag) : null) ||
      (tag ? courseFallbackMap.get(tag.split('-')[0]) : null);

    if (fallback) {
      if (isGenericElectiveLabel(baseSubject.name) && fallback.course_name) {
        subject = {
          ...subject,
          code: fallback.shortform || subject.code,
          name: fallback.course_name,
          electiveTag: subject.electiveTag || fallback.electiveTag || null,
        };
      }
      if (!faculty && fallback.facultyInfo) {
        const matchedRecord =
          (fallback.facultyInfo.staffId && facultyLookup.get(`id:${String(fallback.facultyInfo.staffId).trim().toUpperCase()}`)) ||
          (fallback.facultyInfo.name && facultyLookup.get(`name:${fallback.facultyInfo.name.trim().toLowerCase()}`)) ||
          null;
        faculty = matchedRecord
          ? facultyPayload(matchedRecord)
          : {
            id: null,
            name: fallback.facultyInfo.name,
            staffId: fallback.facultyInfo.staffId || null,
            designation: null,
            department: null,
            qualification: null,
            email: null,
            profileSourceUrl: null,
            imageSourceUrl: null,
            imageUrl: null,
          };
      }
    }
  }

  return {
    subject,
    faculty,
    batchBFaculty: facultyPayload(baseBatchBFaculty),
  };
}

function subjectPayload(subj, electiveMap) {
  if (!subj) return null;
  const electiveTag = resolveElectiveTag(subj, electiveMap);
  return {
    id: subj.id,
    code: subj.code,
    name: subj.name,
    isBreak: subj.isBreak,
    electiveTag: electiveTag || null,
  };
}

function facultyPayload(faculty) {
  if (!faculty) return null;
  return {
    id: faculty.id,
    name: faculty.name,
    staffId: faculty.staffId,
    designation: faculty.designation,
    department: faculty.department,
    qualification: faculty.qualification,
    email: faculty.email,
    profileSourceUrl: faculty.profileSourceUrl,
    imageSourceUrl: faculty.imageSourceUrl,
    imageUrl: faculty.imageSourceUrl || (faculty.imageData ? `/api/faculty/${faculty.id}/image` : null),
  };
}

async function listClasses() {
  const classes = await prisma.classRoom.findMany({ orderBy: [{ year: 'asc' }, { branch: 'asc' }, { section: 'asc' }] });
  return classes.map((classRoom) => ({ ...classRoom, label: classLabel(classRoom) }));
}

async function getTimetable(classId, date) {
  const classRoom = await prisma.classRoom.findUnique({ where: { id: classId } });
  if (!classRoom) return null;

  const day = getTimetableDay(date);
  const slots = day > 5 ? [] : await prisma.timetableSlot.findMany({
    where: { classId, day },
    orderBy: { startTime: 'asc' },
    include: { subject: true, faculty: true, batchBFaculty: true },
  });

  const overrides = day > 5 ? [] : await prisma.timetableOverride.findMany({
    where: { classId, date },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: { subject: true, faculty: true, batchBFaculty: true },
  });
  const electiveMap = buildClassElectiveMap(classRoom.metadata);
  const courseFallbackMap = buildClassCourseFallbackMap(classRoom.metadata);
  const facultyLookup = await resolveFallbackFacultyMap(courseFallbackMap);
  const resolvedSlots = applyOverrides(slots, overrides);

  return {
    class: { id: classRoom.id, label: classLabel(classRoom) },
    date: date.toISOString().slice(0, 10),
    day,
    slots: resolvedSlots.map(({ override, ...slot }) => {
      const resolved = resolveSlotWithCourseFallback(slot, override, electiveMap, courseFallbackMap, facultyLookup);
      return {
        id: slot.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        room: resolveSlotRoom(override || slot, classRoom.metadata, DAY_NAMES[day]),
        subject: resolved.subject,
        faculty: resolved.faculty,
        batchBFaculty: resolved.batchBFaculty,
        isOverride: Boolean(override),
        override: override ? {
          id: override.id,
          startTime: override.startTime,
          endTime: override.endTime,
          createdAt: override.createdAt,
        } : null,
      };
    }),
  };
}

async function getWeeklyTimetable(classId, referenceDate) {
  const classRoom = await prisma.classRoom.findUnique({ where: { id: classId } });
  if (!classRoom) return null;

  const ref = new Date(referenceDate);
  const dayOfWeek = ref.getUTCDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(ref);
  monday.setUTCDate(ref.getUTCDate() + diffToMonday);
  monday.setUTCHours(0, 0, 0, 0);

  const saturday = new Date(monday);
  saturday.setUTCDate(monday.getUTCDate() + 5);
  saturday.setUTCHours(23, 59, 59, 999);

  const [allSlots, allOverrides] = await Promise.all([
    prisma.timetableSlot.findMany({
      where: { classId },
      orderBy: [{ day: 'asc' }, { startTime: 'asc' }],
      include: { subject: true, faculty: true, batchBFaculty: true },
    }),
    prisma.timetableOverride.findMany({
      where: { classId, date: { gte: monday, lte: saturday } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { subject: true, faculty: true, batchBFaculty: true },
    }),
  ]);

  const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const electiveMap = buildClassElectiveMap(classRoom.metadata);
  const courseFallbackMap = buildClassCourseFallbackMap(classRoom.metadata);
  const facultyLookup = await resolveFallbackFacultyMap(courseFallbackMap);
  const days = [];
  for (let dayIndex = 0; dayIndex <= 5; dayIndex++) {
    const dayDate = new Date(monday);
    dayDate.setUTCDate(monday.getUTCDate() + dayIndex);
    const dayDateStr = dayDate.toISOString().slice(0, 10);

    const daySlots = allSlots.filter((s) => s.day === dayIndex);
    const dayOverrides = allOverrides.filter((o) => o.date.toISOString().slice(0, 10) === dayDateStr);
    const resolvedSlots = applyOverrides(daySlots, dayOverrides);

    days.push({
      day: dayIndex,
      dayName: DAY_NAMES[dayIndex],
      date: dayDateStr,
      slots: resolvedSlots.map(({ override, ...slot }) => {
        const res = resolveSlotWithCourseFallback(slot, override, electiveMap, courseFallbackMap, facultyLookup);
        return {
          id: slot.id,
          startTime: slot.startTime,
          endTime: slot.endTime,
          room: resolveSlotRoom(override || slot, classRoom.metadata, DAY_NAMES[dayIndex]),
          subject: res.subject,
          faculty: res.faculty,
          batchBFaculty: res.batchBFaculty,
          isOverride: Boolean(override),
          override: override ? {
            id: override.id,
            startTime: override.startTime,
            endTime: override.endTime,
            createdAt: override.createdAt,
          } : null,
        };
      }),
    });
  }

  // Extract distinct periods sorted by start time
  const periodMap = new Map();
  for (const slot of allSlots) {
    const key = `${slot.startTime}-${slot.endTime}`;
    if (!periodMap.has(key)) {
      periodMap.set(key, { startTime: slot.startTime, endTime: slot.endTime });
    }
  }
  for (const ov of allOverrides) {
    const key = `${ov.startTime}-${ov.endTime}`;
    if (!periodMap.has(key)) {
      periodMap.set(key, { startTime: ov.startTime, endTime: ov.endTime });
    }
  }
  const periods = Array.from(periodMap.values()).sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Extract distinct courses and faculty directory
  const courseMap = new Map();
  function registerCourse(subj, fac) {
    if (!subj || subj.isBreak || subj.code === 'LUNCH') return;
    const key = subj.code || String(subj.id);
    const existing = courseMap.get(key);
    if (!existing) {
      courseMap.set(key, {
        id: subj.id,
        code: subj.code,
        name: subj.name,
        faculty: fac ? facultyPayload(fac) : null,
      });
    } else if (!existing.faculty && fac) {
      existing.faculty = facultyPayload(fac);
    }
  }
  for (const slot of allSlots) registerCourse(slot.subject, slot.faculty);
  for (const ov of allOverrides) registerCourse(ov.subject, ov.faculty);
  const fallbackCourses = Array.from(courseMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  const meta = classRoom.metadata && typeof classRoom.metadata === 'object' ? classRoom.metadata : {};
  const institutionalDetails = {
    academic_year: classRoom.academicYear || meta.academic_year || '2026-27',
    semester: classRoom.semester || meta.semester || `Year ${classRoom.year} Semester I`,
    branch: meta.branch || `${classRoom.branch} ${classRoom.section}`.trim(),
    effective_from: classRoom.effectiveFrom || meta.effective_from || monday.toISOString().slice(0, 10),
    classroom: meta.classroom || {
      theory: '1302',
      labs: {},
      class_coordinator: 'S. Soujanya',
      year_coordinator: 'Dr. G. R. Sakthi Dharan',
    },
    working_hours: meta.working_hours || null,
    academic_calendar: meta.academic_calendar || [],
  };

  let canonicalPeriods = meta.working_hours?.periods?.map((p) => {
    const [s, e] = (p.time || '').split('-');
    return { startTime: s, endTime: e, period: p.period };
  }) || [];

  if (canonicalPeriods.length === 0) {
    const dbPeriods = await prisma.period.findMany({ orderBy: { order: 'asc' } });
    if (dbPeriods.length > 0) {
      canonicalPeriods = dbPeriods.map((p) => ({
        startTime: p.startTime,
        endTime: p.endTime,
        period: p.isBreak ? 'LUNCH' : p.periodNumber,
        isLunch: p.isBreak,
      }));
    }
  }

  const lunchTime = meta.working_hours?.lunch || '12:20-12:55';
  if (lunchTime && canonicalPeriods.length > 0) {
    const [ls, le] = lunchTime.split('-');
    if (ls && le && !canonicalPeriods.some((p) => p.startTime === ls)) {
      canonicalPeriods.push({ startTime: ls, endTime: le, period: 'LUNCH', isLunch: true });
      canonicalPeriods.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
  }

  const canonicalCourses = meta.courses && meta.courses.length > 0 ? meta.courses.map((c) => {
    const electiveTag = extractElectiveTag(c.shortform) || extractElectiveTag(c.course_name) || extractElectiveTag(c.course_code);
    return {
      name: c.course_name || c.shortform,
      course_code: c.course_code,
      shortform: c.shortform,
      course_name: c.course_name,
      electiveTag: electiveTag || null,
      faculty: typeof c.faculty === 'string'
        ? { name: c.faculty, staffId: c.staff_id }
        : (Array.isArray(c.faculty) && c.faculty[0] ? { name: c.faculty[0].name, staffId: c.faculty[0].staff_id } : null),
    };
  }) : fallbackCourses;

  return {
    class: {
      id: classRoom.id,
      year: classRoom.year,
      branch: classRoom.branch,
      section: classRoom.section,
      label: classLabel(classRoom),
      ...institutionalDetails,
    },
    weekStart: monday.toISOString().slice(0, 10),
    weekEnd: saturday.toISOString().slice(0, 10),
    periods: canonicalPeriods && canonicalPeriods.length > 0 ? canonicalPeriods : periods,
    days,
    courses: canonicalCourses,
    academic_calendar: institutionalDetails.academic_calendar,
    classroom: institutionalDetails.classroom,
  };
}

async function getFacultyImage(id) {
  return prisma.faculty.findUnique({
    where: { id },
    select: { imageSourceUrl: true, imageData: true, imageMimeType: true },
  });
}

module.exports = {
  classLabel,
  listClasses,
  getTimetable,
  getWeeklyTimetable,
  getFacultyImage,
  extractElectiveTag,
  buildClassElectiveMap,
  resolveElectiveTag,
};
