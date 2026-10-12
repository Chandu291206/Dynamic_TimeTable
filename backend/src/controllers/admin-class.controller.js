const { z } = require('zod');
const prisma = require('../config/database');
const { classSchema } = require('../validators/class.schema');
const { classLabel } = require('../services/timetable.service');
const logger = require('../utils/logger');

const idSchema = z.coerce.number().int().positive();

function normalizeClass(input) {
  return { year: input.year, branch: input.branch.replace(/\s+/g, ' ').toUpperCase(), section: input.section.replace(/\s+/g, ' ').toUpperCase() };
}

function serialize(classRoom) {
  return { ...classRoom, label: classLabel(classRoom) };
}

function parseId(req, res) {
  const parsed = idSchema.safeParse(req.params.id);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Class ID must be a positive integer',
        fields: parsed.error.flatten().fieldErrors,
      },
    });
    return null;
  }
  return parsed.data;
}

async function list(req, res) {
  const classes = await prisma.classRoom.findMany({ orderBy: [{ year: 'asc' }, { branch: 'asc' }, { section: 'asc' }] });
  return res.json({ success: true, data: classes.map(serialize) });
}

async function create(req, res) {
  const parsed = classSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid class data', fields: parsed.error.flatten().fieldErrors } });
  const data = normalizeClass(parsed.data);
  if (await prisma.classRoom.findUnique({ where: { year_branch_section: data } })) return res.status(409).json({ success: false, error: { code: 'CLASS_EXISTS', message: 'This class already exists' } });
  const classRoom = await prisma.classRoom.create({ data });
  logger.audit('CLASS_CREATED', { classId: classRoom.id, label: classLabel(classRoom), adminUserId: req.user.id });
  return res.status(201).json({ success: true, data: serialize(classRoom) });
}

async function update(req, res) {
  const id = parseId(req, res); if (!id) return undefined;
  const parsed = classSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid class data', fields: parsed.error.flatten().fieldErrors } });
  const data = normalizeClass(parsed.data);
  if (!(await prisma.classRoom.findUnique({ where: { id } }))) return res.status(404).json({ success: false, error: { code: 'CLASS_NOT_FOUND', message: 'Class not found' } });
  const existing = await prisma.classRoom.findUnique({ where: { year_branch_section: data } });
  if (existing && existing.id !== id) return res.status(409).json({ success: false, error: { code: 'CLASS_EXISTS', message: 'This class already exists' } });
  const classRoom = await prisma.classRoom.update({ where: { id }, data });
  logger.audit('CLASS_UPDATED', { classId: classRoom.id, label: classLabel(classRoom), adminUserId: req.user.id });
  return res.json({ success: true, data: serialize(classRoom) });
}

async function remove(req, res) {
  const id = parseId(req, res); if (!id) return undefined;
  const classRoom = await prisma.classRoom.findUnique({
    where: { id },
    include: { _count: { select: { slots: true, overrides: true, users: true } } },
  });
  if (!classRoom) return res.status(404).json({ success: false, error: { code: 'CLASS_NOT_FOUND', message: 'Class not found' } });

  await prisma.$transaction([
    prisma.timetableOverride.deleteMany({ where: { classId: id } }),
    prisma.timetableSlot.deleteMany({ where: { classId: id } }),
    prisma.user.updateMany({ where: { classId: id }, data: { classId: null } }),
    prisma.classRoom.delete({ where: { id } }),
  ]);

  logger.audit('CLASS_DELETED', { classId: id, label: classLabel(classRoom), adminUserId: req.user.id });
  return res.status(204).send();
}

async function clearTimetable(req, res) {
  const id = parseId(req, res); if (!id) return undefined;
  const classRoom = await prisma.classRoom.findUnique({ where: { id } });
  if (!classRoom) return res.status(404).json({ success: false, error: { code: 'CLASS_NOT_FOUND', message: 'Class not found' } });

  const [deletedOverrides, deletedSlots] = await prisma.$transaction([
    prisma.timetableOverride.deleteMany({ where: { classId: id } }),
    prisma.timetableSlot.deleteMany({ where: { classId: id } }),
    prisma.classRoom.update({
      where: { id },
      data: { metadata: null, effectiveFrom: null },
    }),
  ]);

  logger.audit('TIMETABLE_CLEARED', {
    classId: id,
    label: classLabel(classRoom),
    clearedSlots: deletedSlots.count,
    clearedOverrides: deletedOverrides.count,
    adminUserId: req.user.id,
  });

  return res.json({
    success: true,
    message: `Timetable cleared for ${classLabel(classRoom)} (${deletedSlots.count} slots and ${deletedOverrides.count} overrides removed).`,
    data: {
      clearedSlots: deletedSlots.count,
      clearedOverrides: deletedOverrides.count,
    },
  });
}

async function uploadTimetable(req, res) {
  let payload = req.body;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_JSON', message: 'Payload must be valid JSON' },
      });
    }
  }

  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_PAYLOAD', message: 'Request body must be a JSON object' },
    });
  }

  const { validateTimetableJson, importTimetableJson } = require('../services/timetable-json.service');
  const validation = await validateTimetableJson(payload);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid timetable JSON structure',
        fields: validation.error.flatten().fieldErrors,
      },
    });
  }

  try {
    const { classRoom, importedSlotsCount } = await importTimetableJson(validation.data, { db: prisma });
    logger.audit('TIMETABLE_IMPORTED', {
      classId: classRoom.id,
      label: classLabel(classRoom),
      slotsCount: importedSlotsCount,
      adminUserId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      message: `Successfully uploaded and synced timetable for ${classLabel(classRoom)} (${importedSlotsCount} sessions scheduled)`,
      data: serialize(classRoom),
    });
  } catch (err) {
    logger.error('Failed to import timetable', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: { code: 'IMPORT_FAILED', message: err.message || 'Failed to import timetable' },
    });
  }
}

module.exports = { list, create, update, remove, clearTimetable, uploadTimetable };
