const prisma = require('../config/database');
const { timeToMinutes, TIME_PATTERN } = require('../utils/time');
const { parseDate, getTimetableDay, todayAsIsoDate } = require('../utils/dates');
const { applyOverrides } = require('../services/override.service');
const { classLabel, buildClassElectiveMap, resolveElectiveTag } = require('../services/timetable.service');
const { resolveSlotRoom } = require('../utils/room-resolver');

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getCurrentIstTime() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  return { timeStr, dateStr };
}

function serializeFaculty(faculty) {
  if (!faculty) return null;
  return {
    id: faculty.id,
    name: faculty.name,
    staffId: faculty.staffId || null,
    department: faculty.department || null,
    designation: faculty.designation || null,
    profileSourceUrl: faculty.profileSourceUrl || faculty.profileUrl || null,
    imageSourceUrl: faculty.imageSourceUrl || null,
    imageUrl: faculty.imageSourceUrl || (faculty.imageData ? `/api/faculty/${faculty.id}/image` : null),
  };
}

/**
 * GET /api/admin/monitor/live
 * Real-time class session observer across all years, branches and rooms
 */
async function getLiveMonitor(req, res, next) {
  try {
    const { timeStr: istTime, dateStr: istDate } = getCurrentIstTime();
    const queryDate = req.query.date || istDate;
    const queryTime = req.query.time || istTime;
    const yearFilter = req.query.year || 'ALL';

    const parsedDate = parseDate(queryDate);
    if (!parsedDate) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Date must use YYYY-MM-DD format' },
      });
    }

    if (!TIME_PATTERN.test(queryTime)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Time must use HH:MM format (24-hour)' },
      });
    }

    const currentMinutes = timeToMinutes(queryTime);
    const dayIndex = getTimetableDay(parsedDate);
    const isCollegeDay = dayIndex >= 0 && dayIndex <= 5;
    const dayName = isCollegeDay ? DAY_NAMES[dayIndex] : 'Sunday';

    // Fetch classes, periods, slots for this day, and active overrides
    const [classes, periods, slots, overrides] = await Promise.all([
      prisma.classRoom.findMany({
        where: yearFilter !== 'ALL' ? { year: Number(yearFilter) } : undefined,
        orderBy: [{ year: 'asc' }, { branch: 'asc' }, { section: 'asc' }],
      }),
      prisma.period.findMany({ orderBy: { order: 'asc' } }),
      isCollegeDay
        ? prisma.timetableSlot.findMany({
            where: {
              day: dayIndex,
              class: yearFilter !== 'ALL' ? { year: Number(yearFilter) } : undefined,
            },
            include: {
              class: true,
              subject: true,
              faculty: true,
              batchBFaculty: true,
              startPeriod: true,
              endPeriod: true,
            },
            orderBy: [{ startTime: 'asc' }],
          })
        : Promise.resolve([]),
      isCollegeDay
        ? prisma.timetableOverride.findMany({
            where: {
              date: parsedDate,
              class: yearFilter !== 'ALL' ? { year: Number(yearFilter) } : undefined,
            },
            include: {
              class: true,
              subject: true,
              faculty: true,
              batchBFaculty: true,
            },
            orderBy: [{ createdAt: 'desc' }],
          })
        : Promise.resolve([]),
    ]);

    const liveSessions = [];
    const upcomingSessionsByClass = {};
    const teachingFacultyIds = new Set();
    const occupiedRoomSet = new Set();
    const activeOverridesCount = overrides.length;

    // Group slots by class
    const slotsByClass = new Map();
    for (const s of slots) {
      if (!slotsByClass.has(s.classId)) slotsByClass.set(s.classId, []);
      slotsByClass.get(s.classId).push(s);
    }

    const overridesByClass = new Map();
    for (const o of overrides) {
      if (!overridesByClass.has(o.classId)) overridesByClass.set(o.classId, []);
      overridesByClass.get(o.classId).push(o);
    }

    for (const cls of classes) {
      const electiveMap = buildClassElectiveMap(cls.metadata);
      const classSlots = slotsByClass.get(cls.id) || [];
      const classOverrides = overridesByClass.get(cls.id) || [];
      const resolvedSlots = applyOverrides(classSlots, classOverrides);

      let activeSessionForClass = null;
      let nextUpcomingForClass = null;

      for (const slot of resolvedSlots) {
        const startMin = timeToMinutes(slot.startTime);
        const endMin = timeToMinutes(slot.endTime);

        if (startMin === null || endMin === null) continue;

        const room = resolveSlotRoom(slot.override || slot, cls.metadata, dayName);
        const subject = slot.override?.subject || slot.subject;
        const faculty = slot.override?.faculty || slot.faculty;
        const batchBFaculty = slot.override?.batchBFaculty || slot.batchBFaculty;
        const isOverride = Boolean(slot.override);

        const sessionPayload = {
          slotId: slot.id,
          classId: cls.id,
          classLabel: classLabel(cls),
          year: cls.year,
          branch: cls.branch,
          section: cls.section,
          day: dayIndex,
          dayName,
          startTime: slot.startTime,
          endTime: slot.endTime,
          room,
          subject: subject ? {
            id: subject.id,
            code: subject.code,
            name: subject.name,
            isBreak: subject.isBreak,
            electiveTag: resolveElectiveTag(subject, electiveMap) || null,
          } : null,
          faculty: serializeFaculty(faculty),
          batchBFaculty: serializeFaculty(batchBFaculty),
          isOverride,
          overrideDetails: isOverride ? {
            id: slot.override.id,
            reason: slot.override.reason || null,
            createdAt: slot.override.createdAt,
          } : null,
        };

        // Check if currently active: startTime <= currentMinutes < endTime
        if (startMin <= currentMinutes && currentMinutes < endMin) {
          const duration = endMin - startMin;
          const elapsed = currentMinutes - startMin;
          const remaining = endMin - currentMinutes;
          const progressPercent = duration > 0 ? Math.min(100, Math.max(0, Math.round((elapsed / duration) * 100))) : 0;

          activeSessionForClass = {
            ...sessionPayload,
            duration,
            elapsed,
            remaining,
            progressPercent,
          };

          if (faculty?.id) teachingFacultyIds.add(faculty.id);
          if (batchBFaculty?.id) teachingFacultyIds.add(batchBFaculty.id);
          if (room && room !== 'TBA') occupiedRoomSet.add(room);
        }

        // Check if upcoming today
        if (startMin > currentMinutes) {
          if (!nextUpcomingForClass || startMin < timeToMinutes(nextUpcomingForClass.startTime)) {
            nextUpcomingForClass = sessionPayload;
          }
        }
      }

      if (activeSessionForClass) {
        liveSessions.push({
          ...activeSessionForClass,
          nextUpcoming: nextUpcomingForClass,
        });
      } else if (nextUpcomingForClass) {
        upcomingSessionsByClass[cls.id] = nextUpcomingForClass;
      }
    }

    // Build room occupancy list
    const roomMap = new Map();
    for (const session of liveSessions) {
      if (!session.room) continue;
      if (!roomMap.has(session.room)) {
        roomMap.set(session.room, []);
      }
      roomMap.get(session.room).push(session);
    }

    const roomOccupancy = Array.from(roomMap.entries()).map(([roomName, sessionsInRoom]) => ({
      room: roomName,
      status: 'OCCUPIED',
      sessions: sessionsInRoom,
    })).sort((a, b) => a.room.localeCompare(b.room));

    // Sort live sessions by Year -> Branch -> Section
    liveSessions.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      if (a.branch !== b.branch) return a.branch.localeCompare(b.branch);
      return a.section.localeCompare(b.section);
    });

    return res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        queryDate,
        queryTime,
        dayIndex,
        dayName,
        isCollegeDay,
        periods,
        summary: {
          totalClasses: classes.length,
          classesInSession: liveSessions.length,
          facultyTeaching: teachingFacultyIds.size,
          roomsOccupied: occupiedRoomSet.size,
          activeOverridesToday: activeOverridesCount,
        },
        liveSessions,
        upcomingSessions: upcomingSessionsByClass,
        roomOccupancy,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/admin/monitor/master-matrix
 * Full institutional timetable matrix with resolved rooms, year-wise grouping
 */
async function getMasterMatrix(req, res, next) {
  try {
    const yearFilter = req.query.year || 'ALL';
    const dayFilter = req.query.day !== undefined ? Number(req.query.day) : null;
    const { dateStr: istDate } = getCurrentIstTime();
    const queryDate = req.query.date || istDate;
    const parsedDate = parseDate(queryDate) || new Date();

    const [classes, periods, allSlots, allOverrides] = await Promise.all([
      prisma.classRoom.findMany({
        where: yearFilter !== 'ALL' ? { year: Number(yearFilter) } : undefined,
        orderBy: [{ year: 'asc' }, { branch: 'asc' }, { section: 'asc' }],
      }),
      prisma.period.findMany({ orderBy: { order: 'asc' } }),
      prisma.timetableSlot.findMany({
        where: {
          class: yearFilter !== 'ALL' ? { year: Number(yearFilter) } : undefined,
          day: dayFilter !== null && dayFilter >= 0 && dayFilter <= 5 ? dayFilter : undefined,
        },
        include: {
          class: true,
          subject: true,
          faculty: true,
          batchBFaculty: true,
          startPeriod: true,
          endPeriod: true,
        },
        orderBy: [{ day: 'asc' }, { startTime: 'asc' }],
      }),
      prisma.timetableOverride.findMany({
        where: {
          date: parsedDate,
          class: yearFilter !== 'ALL' ? { year: Number(yearFilter) } : undefined,
        },
        include: {
          class: true,
          subject: true,
          faculty: true,
          batchBFaculty: true,
        },
      }),
    ]);

    // Group slots and overrides by classId
    const slotsByClass = new Map();
    for (const s of allSlots) {
      if (!slotsByClass.has(s.classId)) slotsByClass.set(s.classId, []);
      slotsByClass.get(s.classId).push(s);
    }

    const overridesByClass = new Map();
    for (const o of allOverrides) {
      if (!overridesByClass.has(o.classId)) overridesByClass.set(o.classId, []);
      overridesByClass.get(o.classId).push(o);
    }

    // Structure grouped by Year -> Branch -> Array of Classes with weekly slots
    const years = [1, 2, 3, 4];
    const matrixByYear = {};
    for (const y of years) {
      matrixByYear[y] = {};
    }

    for (const cls of classes) {
      const y = cls.year || 1;
      const b = cls.branch || 'General';
      if (!matrixByYear[y]) matrixByYear[y] = {};
      if (!matrixByYear[y][b]) matrixByYear[y][b] = [];

      const rawClassSlots = slotsByClass.get(cls.id) || [];
      const rawClassOverrides = overridesByClass.get(cls.id) || [];

      // Organize by days 0..5
      const daysSchedule = [];
      const daysToIterate = dayFilter !== null && dayFilter >= 0 && dayFilter <= 5 ? [dayFilter] : [0, 1, 2, 3, 4, 5];

      const electiveMap = buildClassElectiveMap(cls.metadata);

      for (const dIdx of daysToIterate) {
        const dSlots = rawClassSlots.filter((s) => s.day === dIdx);
        const resolved = applyOverrides(dSlots, rawClassOverrides);

        daysSchedule.push({
          day: dIdx,
          dayName: DAY_NAMES[dIdx],
          slots: resolved.map(({ override, ...slot }) => {
            const subject = override?.subject || slot.subject;
            const faculty = override?.faculty || slot.faculty;
            const batchBFaculty = override?.batchBFaculty || slot.batchBFaculty;
            const room = resolveSlotRoom(override || slot, cls.metadata, DAY_NAMES[dIdx]);

            return {
              id: slot.id,
              startTime: slot.startTime,
              endTime: slot.endTime,
              room,
              subject: subject ? {
                id: subject.id,
                code: subject.code,
                name: subject.name,
                isBreak: subject.isBreak,
                electiveTag: resolveElectiveTag(subject, electiveMap) || null,
              } : null,
              faculty: serializeFaculty(faculty),
              batchBFaculty: serializeFaculty(batchBFaculty),
              isOverride: Boolean(override),
            };
          }),
        });
      }

      matrixByYear[y][b].push({
        id: cls.id,
        year: cls.year,
        branch: cls.branch,
        section: cls.section,
        academicYear: cls.academicYear,
        label: classLabel(cls),
        defaultRoom: resolveSlotRoom({}, cls.metadata, 'Monday'),
        classroomMeta: cls.metadata?.classroom || null,
        days: daysSchedule,
      });
    }

    return res.json({
      success: true,
      data: {
        periods,
        years: matrixByYear,
        totalClasses: classes.length,
      },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getLiveMonitor,
  getMasterMatrix,
  resolveSlotRoom,
};
