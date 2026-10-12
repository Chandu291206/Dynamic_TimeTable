const { z } = require('zod');
const prisma = require('../config/database');
const { slotSchema } = require('../validators/slot.schema');
const { timeToMinutes, timesOverlap } = require('../utils/time');
const { classLabel } = require('../services/timetable.service');
const logger = require('../utils/logger');

const idSchema = z.coerce.number().int().positive();

function serialize(slot) {
  return {
    id: slot.id,
    classId: slot.classId,
    day: slot.day,
    startTime: slot.startTime,
    endTime: slot.endTime,
    subjectId: slot.subjectId,
    facultyId: slot.facultyId,
    class: slot.class ? { id: slot.class.id, label: classLabel(slot.class) } : undefined,
    subject: slot.subject ? { id: slot.subject.id, name: slot.subject.name } : null,
    faculty: slot.faculty ? { id: slot.faculty.id, name: slot.faculty.name } : null,
    createdAt: slot.createdAt,
    updatedAt: slot.updatedAt,
  };
}

function parseId(req, res) {
  const parsed = idSchema.safeParse(req.params.id);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Slot ID must be a positive integer',
        fields: parsed.error.flatten().fieldErrors,
      },
    });
    return null;
  }
  return parsed.data;
}

async function validateSlot(data, excludedSlotId = null) {
  if (timeToMinutes(data.startTime) >= timeToMinutes(data.endTime)) return { error: { status: 400, code: 'VALIDATION_ERROR', message: 'Start time must be before end time', fields: { endTime: 'End time must be after start time' } } };
  const [classRoom, subject, faculty, slots] = await Promise.all([
    prisma.classRoom.findUnique({ where: { id: data.classId } }),
    data.subjectId ? prisma.subject.findUnique({ where: { id: data.subjectId } }) : null,
    data.facultyId ? prisma.faculty.findUnique({ where: { id: data.facultyId } }) : null,
    prisma.timetableSlot.findMany({ where: { classId: data.classId, day: data.day }, select: { id: true, startTime: true, endTime: true } }),
  ]);
  if (!classRoom) return { error: { status: 400, code: 'VALIDATION_ERROR', message: 'Class not found', fields: { classId: 'Choose an existing class' } } };
  if (data.subjectId && !subject) return { error: { status: 400, code: 'VALIDATION_ERROR', message: 'Subject not found', fields: { subjectId: 'Choose an existing subject' } } };
  if (data.facultyId && !faculty) return { error: { status: 400, code: 'VALIDATION_ERROR', message: 'Faculty member not found', fields: { facultyId: 'Choose an existing faculty member' } } };
  if (slots.some((slot) => slot.id !== excludedSlotId && timesOverlap(data, slot))) return { error: { status: 409, code: 'SLOT_CONFLICT', message: 'This time overlaps an existing slot for the class and day' } };
  return { data };
}

async function list(req, res) {
  const classId = req.query.classId ? idSchema.safeParse(req.query.classId) : null;
  if (classId && !classId.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'classId must be a positive integer' } });
  const slots = await prisma.timetableSlot.findMany({
    where: classId ? { classId: classId.data } : undefined,
    orderBy: [{ classId: 'asc' }, { day: 'asc' }, { startTime: 'asc' }],
    include: { class: true, subject: true, faculty: true },
  });
  return res.json({ success: true, data: slots.map(serialize) });
}

async function create(req, res) {
  const parsed = slotSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid slot data', fields: parsed.error.flatten().fieldErrors } });
  const valid = await validateSlot(parsed.data);
  if (valid.error) return res.status(valid.error.status).json({ success: false, error: valid.error });
  const slot = await prisma.timetableSlot.create({ data: valid.data, include: { class: true, subject: true, faculty: true } });
  logger.audit('SLOT_CREATED', {
    slotId: slot.id,
    classId: slot.classId,
    day: slot.day,
    startTime: slot.startTime,
    endTime: slot.endTime,
    subjectId: slot.subjectId,
    facultyId: slot.facultyId,
    adminId: req.user?.id,
  });
  return res.status(201).json({ success: true, data: serialize(slot) });
}

async function update(req, res) {
  const id = parseId(req, res); if (!id) return undefined;
  const parsed = slotSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid slot data', fields: parsed.error.flatten().fieldErrors } });
  if (!(await prisma.timetableSlot.findUnique({ where: { id } }))) return res.status(404).json({ success: false, error: { code: 'SLOT_NOT_FOUND', message: 'Timetable slot not found' } });
  const valid = await validateSlot(parsed.data, id);
  if (valid.error) return res.status(valid.error.status).json({ success: false, error: valid.error });
  const slot = await prisma.timetableSlot.update({ where: { id }, data: valid.data, include: { class: true, subject: true, faculty: true } });
  logger.audit('SLOT_UPDATED', {
    slotId: slot.id,
    classId: slot.classId,
    day: slot.day,
    startTime: slot.startTime,
    endTime: slot.endTime,
    subjectId: slot.subjectId,
    facultyId: slot.facultyId,
    adminId: req.user?.id,
  });
  return res.json({ success: true, data: serialize(slot) });
}

async function remove(req, res) {
  const id = parseId(req, res); if (!id) return undefined;
  const existing = await prisma.timetableSlot.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ success: false, error: { code: 'SLOT_NOT_FOUND', message: 'Timetable slot not found' } });
  await prisma.timetableSlot.delete({ where: { id } });
  logger.audit('SLOT_DELETED', {
    slotId: id,
    classId: existing.classId,
    day: existing.day,
    adminId: req.user?.id,
  });
  return res.status(204).send();
}

module.exports = { list, create, update, remove };
