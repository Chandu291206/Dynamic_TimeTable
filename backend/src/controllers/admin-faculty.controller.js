const { z } = require('zod');
const prisma = require('../config/database');
const { createFacultySchema, updateFacultySchema } = require('../validators/faculty.schema');
const { normalizeStaffId } = require('../utils/identity');
const facultySync = require('../services/faculty-sync.service');
const facultyWebScraper = require('../services/faculty-web-scraper.service');
const logger = require('../utils/logger');

const idSchema = z.coerce.number().int().positive();

function serialize(faculty) {
  const { imageData, ...safeFaculty } = faculty;
  return {
    ...safeFaculty,
    hasImage: Boolean(faculty.imageSourceUrl),
    imageUrl: faculty.imageSourceUrl || null,
  };
}

function parseId(req, res) {
  const result = idSchema.safeParse(req.params.id);
  if (!result.success) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Faculty ID must be a positive integer',
        fields: result.error.flatten().fieldErrors,
      },
    });
    return null;
  }
  return result.data;
}

async function list(req, res) {
  const faculty = await prisma.faculty.findMany({ orderBy: { name: 'asc' } });
  return res.json({ success: true, data: faculty.map(serialize) });
}

async function getById(req, res) {
  const id = parseId(req, res);
  if (!id) return undefined;
  const faculty = await prisma.faculty.findUnique({ where: { id } });
  if (!faculty) {
    return res.status(404).json({ success: false, error: { code: 'FACULTY_NOT_FOUND', message: 'Faculty member not found' } });
  }
  return res.json({ success: true, data: serialize(faculty) });
}

async function create(req, res) {
  const parsed = createFacultySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid faculty data', fields: parsed.error.flatten().fieldErrors },
    });
  }

  const staffId = normalizeStaffId(parsed.data.staffId);
  if (!staffId) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Staff ID is required',
        fields: { staffId: ['Staff ID is required'] },
      },
    });
  }

  const existing = await prisma.faculty.findUnique({ where: { staffId } });
  if (existing) {
    return res.status(409).json({
      success: false,
      error: { code: 'STAFF_ID_EXISTS', message: `Staff ID '${staffId}' is already assigned to ${existing.name}` },
    });
  }

  const faculty = await prisma.faculty.create({
    data: {
      ...parsed.data,
      staffId,
      isActive: parsed.data.isActive ?? true,
    },
  });

  logger.audit('FACULTY_CREATED', { facultyId: faculty.id, name: faculty.name, staffId: faculty.staffId, adminUserId: req.user.id });
  return res.status(201).json({ success: true, data: serialize(faculty) });
}

async function update(req, res) {
  const id = parseId(req, res);
  if (!id) return undefined;
  const parsed = updateFacultySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid faculty data', fields: parsed.error.flatten().fieldErrors },
    });
  }

  const existing = await prisma.faculty.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ success: false, error: { code: 'FACULTY_NOT_FOUND', message: 'Faculty member not found' } });
  }

  const updateData = { ...parsed.data };
  if (parsed.data.staffId !== undefined) {
    const cleanStaff = normalizeStaffId(parsed.data.staffId);
    if (!cleanStaff) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Staff ID cannot be empty', fields: { staffId: ['Staff ID cannot be empty'] } },
      });
    }
    if (cleanStaff !== existing.staffId) {
      const conflict = await prisma.faculty.findUnique({ where: { staffId: cleanStaff } });
      if (conflict && conflict.id !== id) {
        return res.status(409).json({
          success: false,
          error: { code: 'STAFF_ID_EXISTS', message: `Staff ID '${cleanStaff}' is already in use by another faculty` },
        });
      }
    }
    updateData.staffId = cleanStaff;
  }

  const faculty = await prisma.faculty.update({ where: { id }, data: updateData });
  logger.audit('FACULTY_UPDATED', { facultyId: faculty.id, name: faculty.name, staffId: faculty.staffId, adminUserId: req.user.id });
  return res.json({ success: true, data: serialize(faculty) });
}

async function remove(req, res) {
  const id = parseId(req, res);
  if (!id) return undefined;

  const faculty = await prisma.faculty.findUnique({
    where: { id },
    include: {
      _count: {
        select: { timetableSlots: true, batchBSlots: true, overrides: true, batchBOverrides: true },
      },
    },
  });

  if (!faculty) {
    return res.status(404).json({ success: false, error: { code: 'FACULTY_NOT_FOUND', message: 'Faculty member not found' } });
  }

  const totalReferences =
    faculty._count.timetableSlots +
    faculty._count.batchBSlots +
    faculty._count.overrides +
    faculty._count.batchBOverrides;

  if (totalReferences > 0) {
    return res.status(409).json({
      success: false,
      error: { code: 'FACULTY_IN_USE', message: 'Faculty member is assigned to timetable slots or overrides and cannot be deleted. Deactivate instead.' },
    });
  }

  await prisma.faculty.delete({ where: { id } });
  logger.audit('FACULTY_DELETED', { facultyId: id, name: faculty.name, staffId: faculty.staffId, adminUserId: req.user.id });
  return res.status(204).send();
}

async function sync(req, res) {
  const result = await facultySync.runFacultySync();
  return res.json({ success: true, data: result });
}

async function syncStatus(req, res) {
  const latest = await facultySync.getLatestSyncRun();
  return res.json({ success: true, data: latest });
}

async function scrapeWeb(req, res) {
  const result = await facultyWebScraper.scrapeAndUpdateFaculty();
  return res.json({ success: true, data: result });
}

async function scrapeWebSingle(req, res) {
  const id = parseId(req, res);
  if (!id) return undefined;
  const result = await facultyWebScraper.scrapeAndUpdateFaculty({ facultyId: id });
  return res.json({ success: true, data: result });
}

const { isAllowedGrietUrl } = require('../utils/imageProxy');

async function proxyPdf(req, res) {
  const rawUrl = req.query.url;
  if (!rawUrl) {
    return res.status(400).json({ success: false, error: { code: 'MISSING_URL', message: 'url query parameter is required' } });
  }
  if (!isAllowedGrietUrl(rawUrl)) {
    return res.status(403).json({ success: false, error: { code: 'INVALID_DOMAIN', message: 'Only GRIET HTTP/HTTPS domain URLs can be proxied' } });
  }
  try {
    const response = await fetch(rawUrl, {
      signal: AbortSignal.timeout(15000),
      headers: { 'user-agent': 'Timetable-Management-System/1.0' },
      redirect: 'error',
    });
    if (!response.ok) {
      return res.status(response.status).json({ success: false, error: { code: 'FETCH_FAILED', message: `Upstream HTTP ${response.status}` } });
    }
    res.set('Content-Type', 'application/pdf');
    res.set('X-Content-Type-Options', 'nosniff');
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > 15 * 1024 * 1024) {
      return res.status(413).json({ success: false, error: { code: 'FILE_TOO_LARGE', message: 'PDF exceeds 15MB limit' } });
    }
    return res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    return res.status(502).json({ success: false, error: { code: 'PROXY_FAILED', message: err.message } });
  }
}

async function extractPdfText(req, res) {
  try {
    const { data, url } = req.body || {};
    let buffer;
    if (data) {
      buffer = Buffer.from(data, 'base64');
    } else if (url) {
      if (!isAllowedGrietUrl(url)) {
        return res.status(403).json({ success: false, error: { code: 'INVALID_DOMAIN', message: 'Only GRIET HTTP/HTTPS URLs allowed' } });
      }
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: { 'user-agent': 'Timetable-Management-System/1.0' },
        redirect: 'error',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength > 15 * 1024 * 1024) {
        return res.status(413).json({ success: false, error: { code: 'FILE_TOO_LARGE', message: 'PDF exceeds 15MB limit' } });
      }
      buffer = Buffer.from(arrayBuffer);
    } else {
      return res.status(400).json({ success: false, error: { code: 'MISSING_DATA', message: 'data (base64) or url is required' } });
    }
    const pdf = require('pdf-parse');
    const parsed = await pdf(buffer);
    return res.json({ success: true, data: { text: parsed.text || '' } });
  } catch (err) {
    return res.status(502).json({ success: false, error: { code: 'PDF_PARSE_FAILED', message: err.message } });
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  sync,
  syncStatus,
  scrapeWeb,
  scrapeWebSingle,
  proxyPdf,
  extractPdfText,
};
