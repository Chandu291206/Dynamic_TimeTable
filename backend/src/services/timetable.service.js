const prisma = require('../config/database');
const { getTimetableDay } = require('../utils/dates');
const { applyOverrides } = require('./override.service');

function classLabel(classRoom) {
  return `Y${classRoom.year} - ${classRoom.branch} - ${classRoom.section}`;
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
    imageUrl: faculty.imageData ? `/api/faculty/${faculty.id}/image` : (faculty.imageSourceUrl || null),
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
    include: { subject: true, faculty: true },
  });

  const overrides = day > 5 ? [] : await prisma.timetableOverride.findMany({
    where: { classId, date },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: { subject: true, faculty: true },
  });
  const resolvedSlots = applyOverrides(slots, overrides);

  return {
    class: { id: classRoom.id, label: classLabel(classRoom) },
    date: date.toISOString().slice(0, 10),
    day,
    slots: resolvedSlots.map(({ override, ...slot }) => ({
      id: slot.id,
      startTime: slot.startTime,
      endTime: slot.endTime,
      subject: override ? (override.subject ? { id: override.subject.id, name: override.subject.name } : null) : (slot.subject ? { id: slot.subject.id, name: slot.subject.name } : null),
      faculty: override ? facultyPayload(override.faculty) : facultyPayload(slot.faculty),
      isOverride: Boolean(override),
      override: override ? {
        id: override.id,
        startTime: override.startTime,
        endTime: override.endTime,
        createdAt: override.createdAt,
      } : null,
    })),
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
      include: { subject: true, faculty: true },
    }),
    prisma.timetableOverride.findMany({
      where: { classId, date: { gte: monday, lte: saturday } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { subject: true, faculty: true },
    }),
  ]);

  const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
      slots: resolvedSlots.map(({ override, ...slot }) => ({
        id: slot.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        subject: override ? (override.subject ? { id: override.subject.id, name: override.subject.name } : null) : (slot.subject ? { id: slot.subject.id, name: slot.subject.name } : null),
        faculty: override ? facultyPayload(override.faculty) : facultyPayload(slot.faculty),
        isOverride: Boolean(override),
        override: override ? {
          id: override.id,
          startTime: override.startTime,
          endTime: override.endTime,
          createdAt: override.createdAt,
        } : null,
      })),
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
    if (!subj || !subj.name || subj.name.trim().toUpperCase() === 'LUNCH') return;
    const existing = courseMap.get(subj.name);
    if (!existing) {
      courseMap.set(subj.name, {
        id: subj.id,
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

  const canonicalPeriods = meta.working_hours?.periods?.map((p) => {
    const [s, e] = (p.time || '').split('-');
    return { startTime: s, endTime: e, period: p.period };
  });

  const canonicalCourses = meta.courses && meta.courses.length > 0 ? meta.courses.map((c) => ({
    name: c.shortform || c.course_name,
    course_code: c.course_code,
    shortform: c.shortform,
    course_name: c.course_name,
    faculty: typeof c.faculty === 'string'
      ? { name: c.faculty, staffId: c.staff_id }
      : (Array.isArray(c.faculty) && c.faculty[0] ? { name: c.faculty[0].name, staffId: c.faculty[0].staff_id } : null),
  })) : fallbackCourses;

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
    select: { imageData: true, imageMimeType: true },
  });
}

module.exports = { classLabel, listClasses, getTimetable, getWeeklyTimetable, getFacultyImage };
