const { z } = require('zod');
const prisma = require('../config/database');
const { hashPassword } = require('../utils/password');
const { classLabel } = require('../services/timetable.service');
const { createCRSchema, updateCRSchema, assignCRClassSchema } = require('../validators/cr-user.schema');
const logger = require('../utils/logger');

const idSchema = z.coerce.number().int().positive();

function serializeCR(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    isActive: user.isActive,
    classId: user.classId,
    class: user.class ? { id: user.class.id, label: classLabel(user.class) } : null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function parseId(req, res) {
  const parsed = idSchema.safeParse(req.params.id);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'CR ID must be a positive integer',
        fields: parsed.error.flatten().fieldErrors,
      },
    });
    return null;
  }
  return parsed.data;
}

async function getCR(id) {
  return prisma.user.findFirst({ where: { id, role: 'CR' }, include: { class: true } });
}

async function listCRs(req, res) {
  const users = await prisma.user.findMany({ where: { role: 'CR' }, include: { class: true }, orderBy: { username: 'asc' } });
  return res.json({ success: true, data: users.map(serializeCR) });
}

async function createCR(req, res) {
  const parsed = createCRSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid CR account data', fields: parsed.error.flatten().fieldErrors } });
  const { username, password, classId, isActive } = parsed.data;
  const [existingUser, classRoom] = await Promise.all([
    prisma.user.findUnique({ where: { username } }),
    prisma.classRoom.findUnique({ where: { id: classId } }),
  ]);
  if (existingUser) return res.status(409).json({ success: false, error: { code: 'USERNAME_EXISTS', message: 'Username is already in use' } });
  if (!classRoom) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Class not found', fields: { classId: 'Choose an existing class' } } });

  const user = await prisma.user.create({
    data: { username, passwordHash: await hashPassword(password), role: 'CR', classId, isActive },
    include: { class: true },
  });
  logger.audit('CR_USER_CREATED', { crUserId: user.id, username: user.username, classId: user.classId, adminUserId: req.user.id });
  return res.status(201).json({ success: true, data: serializeCR(user) });
}

async function updateCR(req, res) {
  const id = parseId(req, res);
  if (!id) return undefined;
  const parsed = updateCRSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid CR account data', fields: parsed.error.flatten().fieldErrors } });
  const current = await getCR(id);
  if (!current) return res.status(404).json({ success: false, error: { code: 'CR_NOT_FOUND', message: 'CR account not found' } });

  const data = { ...parsed.data };
  if (data.username && data.username !== current.username) {
    const existingUser = await prisma.user.findUnique({ where: { username: data.username } });
    if (existingUser) return res.status(409).json({ success: false, error: { code: 'USERNAME_EXISTS', message: 'Username is already in use' } });
  }
  if (data.password) {
    data.passwordHash = await hashPassword(data.password);
    delete data.password;
  }
  const user = await prisma.user.update({ where: { id }, data, include: { class: true } });
  logger.audit('CR_USER_UPDATED', { crUserId: user.id, username: user.username, classId: user.classId, adminUserId: req.user.id });
  return res.json({ success: true, data: serializeCR(user) });
}

async function assignCRClass(req, res) {
  const id = parseId(req, res);
  if (!id) return undefined;
  const parsed = assignCRClassSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid class assignment', fields: parsed.error.flatten().fieldErrors } });
  if (!(await getCR(id))) return res.status(404).json({ success: false, error: { code: 'CR_NOT_FOUND', message: 'CR account not found' } });
  if (parsed.data.classId && !(await prisma.classRoom.findUnique({ where: { id: parsed.data.classId } }))) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Class not found', fields: { classId: 'Choose an existing class' } } });
  }
  const user = await prisma.user.update({ where: { id }, data: { classId: parsed.data.classId }, include: { class: true } });
  logger.audit('CR_CLASS_ASSIGNED', { crUserId: user.id, classId: user.classId, adminUserId: req.user.id });
  return res.json({ success: true, data: serializeCR(user) });
}

async function deleteCR(req, res) {
  const id = parseId(req, res);
  if (!id) return undefined;
  if (!(await getCR(id))) return res.status(404).json({ success: false, error: { code: 'CR_NOT_FOUND', message: 'CR account not found' } });
  await prisma.user.delete({ where: { id } });
  logger.audit('CR_USER_DELETED', { crUserId: id, adminUserId: req.user.id });
  return res.status(204).send();
}

module.exports = { listCRs, createCR, updateCR, assignCRClass, deleteCR };
