const { z } = require('zod');
const prisma = require('../config/database');
const { classLabel, getTimetable } = require('../services/timetable.service');
const { parseDate, todayAsIsoDate } = require('../utils/dates');
const { timeToMinutes, timesOverlap } = require('../utils/time');
const { createOverrideSchema } = require('../validators/override.schema');
const logger = require('../utils/logger');

const daysSchema = z.coerce.number().int().min(1).max(31).default(7);

function formatOverride(override) {
  return {
    id: override.id,
    date: override.date.toISOString().slice(0, 10),
    startTime: override.startTime,
    endTime: override.endTime,
    subject: override.subject ? { id: override.subject.id, name: override.subject.name } : null,
    faculty: override.faculty ? { id: override.faculty.id, name: override.faculty.name } : null,
    createdAt: override.createdAt,
  };
}

async function dashboard(req, res) {
  const classRoom = await prisma.classRoom.findUnique({ where: { id: req.user.classId } });
  if (!classRoom) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Your assigned class is unavailable' } });
  }

  const todayValue = todayAsIsoDate();
  const today = parseDate(todayValue);
  const endDate = new Date(today);
  endDate.setUTCDate(endDate.getUTCDate() + 7);
  const [timetable, overrides, subjects, faculty] = await Promise.all([
    getTimetable(classRoom.id, today),
    prisma.timetableOverride.findMany({
      where: { classId: classRoom.id, date: { gte: today, lte: endDate } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      include: { subject: true, faculty: true },
    }),
    prisma.subject.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.faculty.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, department: true } }),
  ]);

  return res.json({
    success: true,
    data: {
      user: req.user,
      class: { id: classRoom.id, label: classLabel(classRoom) },
      timetable,
      upcomingOverrides: overrides.map(formatOverride),
      subjects,
      faculty,
    },
  });
}

async function upcomingOverrides(req, res) {
  const parsedDays = daysSchema.safeParse(req.query.days);
  if (!parsedDays.success) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'days must be an integer between 1 and 31' } });
  }

  const today = parseDate(todayAsIsoDate());
  const endDate = new Date(today);
  endDate.setUTCDate(endDate.getUTCDate() + parsedDays.data);
  const overrides = await prisma.timetableOverride.findMany({
    where: { classId: req.user.classId, date: { gte: today, lte: endDate } },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    include: { subject: true, faculty: true },
  });
  return res.json({ success: true, data: overrides.map(formatOverride) });
}

async function createOverride(req, res) {
  const parsed = createOverrideSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid override data', fields: parsed.error.flatten().fieldErrors } });
  }

  const { date: dateValue, startTime, endTime, subjectId = null, facultyId = null } = parsed.data;
  const date = parseDate(dateValue);
  if (!date) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Date must be valid' } });
  }
  if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Start time must be before end time', fields: { endTime: 'End time must be after start time' } } });
  }

  const day = date.getUTCDay() === 0 ? 6 : date.getUTCDay() - 1;
  if (day > 5) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_OVERRIDE', message: 'Overrides require a scheduled Monday–Saturday timetable day' } });
  }

  const [subject, faculty, recurringSlots, existingOverrides] = await Promise.all([
    subjectId ? prisma.subject.findUnique({ where: { id: subjectId } }) : null,
    facultyId ? prisma.faculty.findUnique({ where: { id: facultyId } }) : null,
    prisma.timetableSlot.findMany({ where: { classId: req.user.classId, day }, select: { startTime: true, endTime: true } }),
    prisma.timetableOverride.findMany({ where: { classId: req.user.classId, date }, select: { startTime: true, endTime: true } }),
  ]);
  if (subjectId && !subject) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Subject not found', fields: { subjectId: 'Choose an existing subject' } } });
  if (facultyId && !faculty) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Faculty member not found', fields: { facultyId: 'Choose an existing faculty member' } } });

  const proposed = { startTime, endTime };
  if (!recurringSlots.some((slot) => timesOverlap(proposed, slot))) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_OVERRIDE', message: 'Override must overlap an existing timetable slot' } });
  }
  if (existingOverrides.some((override) => timesOverlap(proposed, override))) {
    return res.status(409).json({ success: false, error: { code: 'OVERRIDE_CONFLICT', message: 'This override conflicts with an existing override for the class and date' } });
  }

  const override = await prisma.timetableOverride.create({
    data: { classId: req.user.classId, date, startTime, endTime, subjectId, facultyId },
    include: { subject: true, faculty: true },
  });
  logger.audit('OVERRIDE_CREATED', { overrideId: override.id, classId: override.classId, date: dateValue, startTime, endTime, crUserId: req.user.id });
  return res.status(201).json({ success: true, data: formatOverride(override) });
}

async function deleteOverride(req, res) {
  const parsedId = z.coerce.number().int().positive().safeParse(req.params.id);
  if (!parsedId.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Override ID must be a positive integer', fields: parsedId.error.flatten().fieldErrors },
    });
  }

  const override = await prisma.timetableOverride.findUnique({
    where: { id: parsedId.data },
  });
  if (!override) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Override not found' } });
  }

  if (override.classId !== req.user.classId) {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'You do not have permission to delete overrides for another class' },
    });
  }

  await prisma.timetableOverride.delete({ where: { id: parsedId.data } });
  logger.audit('OVERRIDE_DELETED', { overrideId: override.id, classId: override.classId, crUserId: req.user.id });
  return res.status(204).send();
}

module.exports = { dashboard, upcomingOverrides, createOverride, deleteOverride };
