const { z } = require('zod');
const prisma = require('../config/database');
const { slotSchema } = require('../validators/slot.schema');
const { classLabel } = require('../services/timetable.service');
const { recordLog } = require('../services/timetable-log.service');
const { resolvePeriodsFromList } = require('../utils/period-resolver');
const {
  validateSlotNoClash,
  acquireClashLock,
  ClashError,
  getFacultyBusyMap,
  getLiveClashesReport,
} = require('../services/clash.service');
const logger = require('../utils/logger');

const idSchema = z.coerce.number().int().positive();

function serialize(slot) {
  return {
    id: slot.id,
    classId: slot.classId,
    day: slot.day,
    startTime: slot.startTime,
    endTime: slot.endTime,
    room: slot.room || null,
    startPeriodId: slot.startPeriodId || null,
    endPeriodId: slot.endPeriodId || null,
    subjectId: slot.subjectId,
    facultyId: slot.facultyId,
    batchBFacultyId: slot.batchBFacultyId || null,
    class: slot.class ? { id: slot.class.id, label: classLabel(slot.class) } : undefined,
    subject: slot.subject ? { id: slot.subject.id, code: slot.subject.code, name: slot.subject.name, isBreak: slot.subject.isBreak } : null,
    faculty: slot.faculty ? { id: slot.faculty.id, name: slot.faculty.name, staffId: slot.faculty.staffId } : null,
    batchBFaculty: slot.batchBFaculty ? { id: slot.batchBFaculty.id, name: slot.batchBFaculty.name, staffId: slot.batchBFaculty.staffId } : null,
    startPeriod: slot.startPeriod ? { id: slot.startPeriod.id, order: slot.startPeriod.order, name: slot.startPeriod.name } : null,
    endPeriod: slot.endPeriod ? { id: slot.endPeriod.id, order: slot.endPeriod.order, name: slot.endPeriod.name } : null,
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

async function list(req, res) {
  const classId = req.query.classId ? idSchema.safeParse(req.query.classId) : null;
  if (classId && !classId.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'classId must be a positive integer' } });
  const slots = await prisma.timetableSlot.findMany({
    where: classId ? { classId: classId.data } : undefined,
    orderBy: [{ classId: 'asc' }, { day: 'asc' }, { startTime: 'asc' }],
    include: { class: true, subject: true, faculty: true, batchBFaculty: true, startPeriod: true, endPeriod: true },
  });
  return res.json({ success: true, data: slots.map(serialize) });
}

async function create(req, res, next) {
  const parsed = slotSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid slot data', fields: parsed.error.flatten().fieldErrors },
    });
  }

  try {
    const slot = await prisma.$transaction(async (tx) => {
      await acquireClashLock(tx);
      await validateSlotNoClash({ slot: parsed.data, tx });

      const periods = await tx.period.findMany({ orderBy: { order: 'asc' } });
      const { startPeriodId, endPeriodId } = resolvePeriodsFromList(parsed.data.startTime, parsed.data.endTime, periods);

      const createData = {
        ...parsed.data,
        startPeriodId: parsed.data.startPeriodId || startPeriodId,
        endPeriodId: parsed.data.endPeriodId || endPeriodId,
      };

      return tx.timetableSlot.create({
        data: createData,
        include: { class: true, subject: true, faculty: true, batchBFaculty: true, startPeriod: true, endPeriod: true },
      });
    });

    logger.audit('SLOT_CREATED', {
      slotId: slot.id,
      classId: slot.classId,
      day: slot.day,
      startTime: slot.startTime,
      endTime: slot.endTime,
      room: slot.room,
      subjectId: slot.subjectId,
      facultyId: slot.facultyId,
      batchBFacultyId: slot.batchBFacultyId,
      adminId: req.user?.id,
    });

    await recordLog({
      action: 'SLOT_CREATED',
      performedBy: req.user?.username || 'Administrator',
      year: slot.class?.year,
      branch: slot.class?.branch,
      section: slot.class?.section,
      day: slot.day,
      date: new Date().toISOString().slice(0, 10),
      details: `Added slot ${slot.startTime}–${slot.endTime} (${slot.subject?.name || 'No subject'} / ${slot.faculty?.name || 'TBA'}) for ${slot.class ? classLabel(slot.class) : 'Class'}`,
    });

    return res.status(201).json({ success: true, data: serialize(slot) });
  } catch (err) {
    if (err instanceof ClashError) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CLASH_DETECTED',
          message: err.message,
          clashes: err.clashes,
        },
      });
    }
    if (err.status && err.code) {
      return res.status(err.status).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
          fields: err.fields,
        },
      });
    }
    return next(err);
  }
}

async function update(req, res, next) {
  const id = parseId(req, res);
  if (!id) return undefined;

  const parsed = slotSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid slot data', fields: parsed.error.flatten().fieldErrors },
    });
  }

  const existing = await prisma.timetableSlot.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ success: false, error: { code: 'SLOT_NOT_FOUND', message: 'Timetable slot not found' } });
  }

  try {
    const slot = await prisma.$transaction(async (tx) => {
      await acquireClashLock(tx);
      await validateSlotNoClash({ slot: { ...parsed.data, id }, excludeSlotId: id, tx });

      const periods = await tx.period.findMany({ orderBy: { order: 'asc' } });
      const { startPeriodId, endPeriodId } = resolvePeriodsFromList(parsed.data.startTime, parsed.data.endTime, periods);

      const updateData = {
        ...parsed.data,
        startPeriodId: parsed.data.startPeriodId !== undefined ? parsed.data.startPeriodId : startPeriodId,
        endPeriodId: parsed.data.endPeriodId !== undefined ? parsed.data.endPeriodId : endPeriodId,
      };

      return tx.timetableSlot.update({
        where: { id },
        data: updateData,
        include: { class: true, subject: true, faculty: true, batchBFaculty: true, startPeriod: true, endPeriod: true },
      });
    });

    logger.audit('SLOT_UPDATED', {
      slotId: slot.id,
      classId: slot.classId,
      day: slot.day,
      startTime: slot.startTime,
      endTime: slot.endTime,
      room: slot.room,
      subjectId: slot.subjectId,
      facultyId: slot.facultyId,
      batchBFacultyId: slot.batchBFacultyId,
      adminId: req.user?.id,
    });

    await recordLog({
      action: 'SLOT_UPDATED',
      performedBy: req.user?.username || 'Administrator',
      year: slot.class?.year,
      branch: slot.class?.branch,
      section: slot.class?.section,
      day: slot.day,
      date: new Date().toISOString().slice(0, 10),
      details: `Updated slot ${slot.startTime}–${slot.endTime} (${slot.subject?.name || 'No subject'} / ${slot.faculty?.name || 'TBA'}) for ${slot.class ? classLabel(slot.class) : 'Class'}`,
    });

    return res.json({ success: true, data: serialize(slot) });
  } catch (err) {
    if (err instanceof ClashError) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CLASH_DETECTED',
          message: err.message,
          clashes: err.clashes,
        },
      });
    }
    if (err.status && err.code) {
      return res.status(err.status).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
          fields: err.fields,
        },
      });
    }
    return next(err);
  }
}

async function remove(req, res) {
  const id = parseId(req, res);
  if (!id) return undefined;
  const existing = await prisma.timetableSlot.findUnique({ where: { id }, include: { class: true, subject: true } });
  if (!existing) return res.status(404).json({ success: false, error: { code: 'SLOT_NOT_FOUND', message: 'Timetable slot not found' } });
  await prisma.timetableSlot.delete({ where: { id } });
  logger.audit('SLOT_DELETED', { slotId: id, classId: existing.classId, day: existing.day, adminId: req.user?.id });
  await recordLog({
    action: 'SLOT_DELETED',
    performedBy: req.user?.username || 'Administrator',
    year: existing.class?.year,
    branch: existing.class?.branch,
    section: existing.class?.section,
    day: existing.day,
    date: new Date().toISOString().slice(0, 10),
    details: `Removed slot ${existing.startTime}–${existing.endTime} (${existing.subject?.name || 'No subject'}) from ${existing.class ? classLabel(existing.class) : 'Class'}`,
  });
  return res.status(204).send();
}

async function conflictsReport(req, res, next) {
  try {
    const data = await getLiveClashesReport();
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function facultyBusyMap(req, res, next) {
  try {
    const excludeClassId = req.query.excludeClassId ? Number(req.query.excludeClassId) : null;
    const data = await getFacultyBusyMap({ excludeClassId });
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  list,
  create,
  update,
  remove,
  conflictsReport,
  facultyBusyMap,
};
