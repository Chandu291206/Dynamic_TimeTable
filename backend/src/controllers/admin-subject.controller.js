const { z } = require('zod');
const prisma = require('../config/database');
const { subjectSchema } = require('../validators/subject.schema');
const { normalizeSubjectCode } = require('../utils/identity');
const logger = require('../utils/logger');

const idSchema = z.coerce.number().int().positive();

function normalizeName(name) {
  return name.replace(/\s+/g, ' ').trim();
}

function parseId(req, res) {
  const parsed = idSchema.safeParse(req.params.id);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Subject ID must be a positive integer',
        fields: parsed.error.flatten().fieldErrors,
      },
    });
    return null;
  }
  return parsed.data;
}

async function list(req, res) {
  const subjects = await prisma.subject.findMany({ orderBy: [{ name: 'asc' }] });
  return res.json({ success: true, data: subjects });
}

async function create(req, res) {
  const parsed = subjectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid subject data',
        fields: parsed.error.flatten().fieldErrors,
      },
    });
  }

  const name = normalizeName(parsed.data.name);
  const code = normalizeSubjectCode(parsed.data.code || name);
  const isBreak = Boolean(parsed.data.isBreak || code === 'LUNCH');

  if (await prisma.subject.findUnique({ where: { code } })) {
    return res.status(409).json({
      success: false,
      error: { code: 'SUBJECT_EXISTS', message: `A subject with code '${code}' already exists` },
    });
  }

  const subject = await prisma.subject.create({
    data: {
      name,
      code,
      isBreak,
      isActive: parsed.data.isActive ?? true,
    },
  });

  logger.audit('SUBJECT_CREATED', { subjectId: subject.id, name: subject.name, code: subject.code, adminUserId: req.user.id });
  return res.status(201).json({ success: true, data: subject });
}

async function update(req, res) {
  const id = parseId(req, res);
  if (!id) return undefined;

  const parsed = subjectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid subject data',
        fields: parsed.error.flatten().fieldErrors,
      },
    });
  }

  const existing = await prisma.subject.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ success: false, error: { code: 'SUBJECT_NOT_FOUND', message: 'Subject not found' } });
  }

  const name = normalizeName(parsed.data.name);
  const code = parsed.data.code ? normalizeSubjectCode(parsed.data.code) : existing.code;
  const isBreak = parsed.data.isBreak !== undefined ? parsed.data.isBreak : existing.isBreak;

  if (code !== existing.code) {
    const codeConflict = await prisma.subject.findUnique({ where: { code } });
    if (codeConflict && codeConflict.id !== id) {
      return res.status(409).json({
        success: false,
        error: { code: 'SUBJECT_EXISTS', message: `A subject with code '${code}' already exists` },
      });
    }
  }

  const subject = await prisma.subject.update({
    where: { id },
    data: {
      name,
      code,
      isBreak,
      isActive: parsed.data.isActive !== undefined ? parsed.data.isActive : existing.isActive,
    },
  });

  logger.audit('SUBJECT_UPDATED', { subjectId: subject.id, name: subject.name, code: subject.code, adminUserId: req.user.id });
  return res.json({ success: true, data: subject });
}

async function remove(req, res) {
  const id = parseId(req, res);
  if (!id) return undefined;

  const subject = await prisma.subject.findUnique({
    where: { id },
    include: { _count: { select: { timetableSlots: true, overrides: true } } },
  });

  if (!subject) {
    return res.status(404).json({ success: false, error: { code: 'SUBJECT_NOT_FOUND', message: 'Subject not found' } });
  }

  if (subject._count.timetableSlots || subject._count.overrides) {
    return res.status(409).json({
      success: false,
      error: { code: 'SUBJECT_IN_USE', message: 'Subject is referenced by timetable data and cannot be deleted' },
    });
  }

  await prisma.subject.delete({ where: { id } });
  logger.audit('SUBJECT_DELETED', { subjectId: id, name: subject.name, code: subject.code, adminUserId: req.user.id });
  return res.status(204).send();
}

module.exports = { list, create, update, remove };
