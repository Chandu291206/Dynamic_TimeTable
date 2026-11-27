const prisma = require('../config/database');
const { classLabel } = require('../services/timetable.service');
const { resolveSlotRoom } = require('../utils/room-resolver');
const { scrapeSingleFaculty } = require('../services/faculty-web-scraper.service');
const logger = require('../utils/logger');

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatFacultyProfile(faculty) {
  if (!faculty) return null;
  return {
    id: faculty.id,
    name: faculty.name,
    staffId: faculty.staffId,
    department: faculty.department,
    designation: faculty.designation,
    qualification: faculty.qualification,
    email: faculty.email,
    profileSourceUrl: faculty.profileSourceUrl,
    imageSourceUrl: faculty.imageSourceUrl,
    lastScrapedAt: faculty.lastScrapedAt,
  };
}

async function dashboard(req, res) {
  const facultyId = req.user?.facultyId;
  if (!facultyId) {
    return res.status(403).json({
      success: false,
      error: { code: 'NO_FACULTY_LINK', message: 'Your account is not linked to a faculty profile. Contact an administrator.' },
    });
  }

  const [faculty, slots, periods] = await Promise.all([
    prisma.faculty.findUnique({ where: { id: facultyId } }),
    prisma.timetableSlot.findMany({
      where: {
        OR: [{ facultyId }, { batchBFacultyId: facultyId }],
      },
      orderBy: [{ day: 'asc' }, { startTime: 'asc' }],
      include: {
        class: true,
        subject: true,
        faculty: true,
        batchBFaculty: true,
      },
    }),
    prisma.period.findMany({ orderBy: { order: 'asc' } }),
  ]);

  if (!faculty) {
    return res.status(404).json({
      success: false,
      error: { code: 'FACULTY_NOT_FOUND', message: 'Linked faculty profile was not found.' },
    });
  }

  const formattedSlots = slots.map((slot) => {
    const isPrimary = slot.facultyId === facultyId;
    const isBatchB = slot.batchBFacultyId === facultyId;
    let batch = 'All';
    if (slot.batchBFacultyId) {
      if (isPrimary && !isBatchB) batch = 'Batch A';
      else if (!isPrimary && isBatchB) batch = 'Batch B';
      else batch = 'Batch A & B';
    }

    const meta = slot.class?.metadata && typeof slot.class.metadata === 'object' ? slot.class.metadata : {};
    const dayName = DAY_NAMES[slot.day] || `Day ${slot.day + 1}`;
    const room = resolveSlotRoom(slot, meta, dayName);

    return {
      id: slot.id,
      day: slot.day,
      dayName,
      startTime: slot.startTime,
      endTime: slot.endTime,
      room,
      batch,
      class: slot.class ? {
        id: slot.class.id,
        year: slot.class.year,
        branch: slot.class.branch,
        section: slot.class.section,
        label: classLabel(slot.class),
      } : null,
      subject: slot.subject ? {
        id: slot.subject.id,
        code: slot.subject.code,
        name: slot.subject.name,
        isBreak: slot.subject.isBreak,
      } : null,
    };
  });

  const canonicalPeriods = periods
    .filter((p) => !p.isBreak)
    .map((p) => ({
      startTime: p.startTime,
      endTime: p.endTime,
      period: p.periodNumber,
      name: p.name,
    }));

  return res.json({
    success: true,
    data: {
      user: req.user,
      faculty: formatFacultyProfile(faculty),
      periods: canonicalPeriods,
      slots: formattedSlots,
    },
  });
}

async function scrapeMyProfile(req, res) {
  const facultyId = req.user?.facultyId;
  if (!facultyId) {
    return res.status(403).json({
      success: false,
      error: { code: 'NO_FACULTY_LINK', message: 'Your account is not linked to a faculty profile.' },
    });
  }

  try {
    const result = await scrapeSingleFaculty(facultyId);
    const updated = await prisma.faculty.findUnique({ where: { id: facultyId } });
    logger.audit('FACULTY_SELF_SCRAPE', { facultyId, userId: req.user.id });
    return res.json({
      success: true,
      data: {
        faculty: formatFacultyProfile(updated),
        scrape: result,
      },
    });
  } catch (err) {
    return res.status(502).json({
      success: false,
      error: { code: 'SCRAPE_FAILED', message: err.message || 'Failed to scrape faculty profile' },
    });
  }
}

module.exports = { dashboard, scrapeMyProfile };
