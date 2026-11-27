const { z } = require('zod');
const prisma = require('../config/database');
const { hashPassword } = require('../utils/password');
const { classLabel } = require('../services/timetable.service');
const { createCRSchema, updateCRSchema, assignCRClassSchema } = require('../validators/cr-user.schema');
const logger = require('../utils/logger');

const idSchema = z.coerce.number().int().positive();
const MANAGED_ROLES = ['CR', 'FACULTY', 'HOD'];

function serializeAccount(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    isActive: user.isActive,
    classId: user.classId,
    facultyId: user.facultyId || null,
    class: user.class ? { id: user.class.id, label: classLabel(user.class) } : null,
    faculty: user.faculty ? {
      id: user.faculty.id,
      name: user.faculty.name,
      staffId: user.faculty.staffId,
      department: user.faculty.department,
      designation: user.faculty.designation,
    } : null,
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
        message: 'Account ID must be a positive integer',
        fields: parsed.error.flatten().fieldErrors,
      },
    });
    return null;
  }
  return parsed.data;
}

async function getManagedAccount(id) {
  return prisma.user.findFirst({
    where: { id, role: { in: MANAGED_ROLES } },
    include: { class: true, faculty: true },
  });
}

async function listCRs(req, res) {
  const users = await prisma.user.findMany({
    where: { role: 'CR' },
    include: { class: true, faculty: true },
    orderBy: { username: 'asc' },
  });
  return res.json({ success: true, data: users.map(serializeAccount) });
}

async function listAccounts(req, res) {
  const users = await prisma.user.findMany({
    where: { role: { in: MANAGED_ROLES } },
    include: { class: true, faculty: true },
    orderBy: [{ role: 'asc' }, { username: 'asc' }],
  });
  return res.json({ success: true, data: users.map(serializeAccount) });
}

async function createCR(req, res) {
  const parsed = createCRSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid account data', fields: parsed.error.flatten().fieldErrors },
    });
  }

  const { username, password, role, classId, facultyId, isActive } = parsed.data;

  const existingUser = await prisma.user.findUnique({ where: { username } });
  if (existingUser) {
    return res.status(409).json({ success: false, error: { code: 'USERNAME_EXISTS', message: 'Username is already in use' } });
  }

  let resolvedClassId = null;
  let resolvedFacultyId = null;

  if (role === 'CR') {
    const classRoom = await prisma.classRoom.findUnique({ where: { id: classId } });
    if (!classRoom) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Class not found', fields: { classId: 'Choose an existing class' } } });
    }
    resolvedClassId = classId;
  } else if (role === 'FACULTY') {
    const faculty = await prisma.faculty.findUnique({ where: { id: facultyId } });
    if (!faculty) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Faculty profile not found', fields: { facultyId: 'Choose an existing faculty profile' } } });
    }
    resolvedFacultyId = facultyId;
  }

  const user = await prisma.user.create({
    data: {
      username,
      passwordHash: await hashPassword(password),
      role,
      classId: resolvedClassId,
      facultyId: resolvedFacultyId,
      isActive,
    },
    include: { class: true, faculty: true },
  });

  logger.audit('ACCOUNT_CREATED', { targetUserId: user.id, username: user.username, role: user.role, classId: user.classId, facultyId: user.facultyId, adminUserId: req.user.id });
  return res.status(201).json({ success: true, data: serializeAccount(user) });
}

async function updateCR(req, res) {
  const id = parseId(req, res);
  if (!id) return undefined;

  const parsed = updateCRSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid account data', fields: parsed.error.flatten().fieldErrors },
    });
  }

  const current = await getManagedAccount(id);
  if (!current) {
    return res.status(404).json({ success: false, error: { code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' } });
  }

  const data = { ...parsed.data };
  const targetRole = data.role || current.role;

  if (data.username && data.username !== current.username) {
    const existingUser = await prisma.user.findUnique({ where: { username: data.username } });
    if (existingUser) {
      return res.status(409).json({ success: false, error: { code: 'USERNAME_EXISTS', message: 'Username is already in use' } });
    }
  }

  if (data.password) {
    data.passwordHash = await hashPassword(data.password);
    delete data.password;
  }

  if (targetRole === 'CR') {
    const nextClassId = data.classId !== undefined ? data.classId : current.classId;
    if (!nextClassId) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Class assignment is required for CR accounts' } });
    }
    const cls = await prisma.classRoom.findUnique({ where: { id: nextClassId } });
    if (!cls) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Class not found' } });
    }
    data.classId = nextClassId;
    data.facultyId = null;
  } else if (targetRole === 'FACULTY') {
    const nextFacultyId = data.facultyId !== undefined ? data.facultyId : current.facultyId;
    if (!nextFacultyId) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Faculty profile link is required for Faculty accounts' } });
    }
    const fac = await prisma.faculty.findUnique({ where: { id: nextFacultyId } });
    if (!fac) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Faculty profile not found' } });
    }
    data.facultyId = nextFacultyId;
    data.classId = null;
  } else if (targetRole === 'HOD') {
    data.classId = null;
    data.facultyId = null;
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    include: { class: true, faculty: true },
  });

  logger.audit('ACCOUNT_UPDATED', { targetUserId: user.id, username: user.username, role: user.role, classId: user.classId, facultyId: user.facultyId, adminUserId: req.user.id });
  return res.json({ success: true, data: serializeAccount(user) });
}

async function assignCRClass(req, res) {
  const id = parseId(req, res);
  if (!id) return undefined;

  const parsed = assignCRClassSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid class assignment', fields: parsed.error.flatten().fieldErrors } });
  }

  const current = await getManagedAccount(id);
  if (!current) {
    return res.status(404).json({ success: false, error: { code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' } });
  }

  if (parsed.data.classId && !(await prisma.classRoom.findUnique({ where: { id: parsed.data.classId } }))) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Class not found', fields: { classId: 'Choose an existing class' } } });
  }

  const user = await prisma.user.update({
    where: { id },
    data: { classId: parsed.data.classId },
    include: { class: true, faculty: true },
  });

  logger.audit('CR_CLASS_ASSIGNED', { crUserId: user.id, classId: user.classId, adminUserId: req.user.id });
  return res.json({ success: true, data: serializeAccount(user) });
}

async function deleteCR(req, res) {
  const id = parseId(req, res);
  if (!id) return undefined;

  if (!(await getManagedAccount(id))) {
    return res.status(404).json({ success: false, error: { code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' } });
  }

  await prisma.user.delete({ where: { id } });
  logger.audit('ACCOUNT_DELETED', { targetUserId: id, adminUserId: req.user.id });
  return res.status(204).send();
}

module.exports = { listCRs, listAccounts, createCR, updateCR, assignCRClass, deleteCR };
