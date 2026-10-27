const { z } = require('zod');
const prisma = require('../config/database');
const { createFacultySchema, updateFacultySchema } = require('../validators/faculty.schema');
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
  const id = parseId(req, res); if (!id) return undefined;
  const faculty = await prisma.faculty.findUnique({ where: { id } });
  if (!faculty) return res.status(404).json({ success: false, error: { code: 'FACULTY_NOT_FOUND', message: 'Faculty member not found' } });
  return res.json({ success: true, data: serialize(faculty) });
}

async function create(req, res) {
  const parsed = createFacultySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid faculty data', fields: parsed.error.flatten().fieldErrors } });
  if (parsed.data.staffId && await prisma.faculty.findUnique({ where: { staffId: parsed.data.staffId } })) return res.status(409).json({ success: false, error: { code: 'STAFF_ID_EXISTS', message: 'Staff ID is already in use' } });
  const faculty = await prisma.faculty.create({ data: parsed.data });
  logger.audit('FACULTY_CREATED', { facultyId: faculty.id, name: faculty.name, staffId: faculty.staffId, adminUserId: req.user.id });
  return res.status(201).json({ success: true, data: serialize(faculty) });
}

async function update(req, res) {
  const id = parseId(req, res); if (!id) return undefined;
  const parsed = updateFacultySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid faculty data', fields: parsed.error.flatten().fieldErrors } });
  if (!(await prisma.faculty.findUnique({ where: { id } }))) return res.status(404).json({ success: false, error: { code: 'FACULTY_NOT_FOUND', message: 'Faculty member not found' } });
  if (parsed.data.staffId) {
    const existing = await prisma.faculty.findUnique({ where: { staffId: parsed.data.staffId } });
    if (existing && existing.id !== id) return res.status(409).json({ success: false, error: { code: 'STAFF_ID_EXISTS', message: 'Staff ID is already in use' } });
  }
  const faculty = await prisma.faculty.update({ where: { id }, data: parsed.data });
  logger.audit('FACULTY_UPDATED', { facultyId: faculty.id, name: faculty.name, adminUserId: req.user.id });
  return res.json({ success: true, data: serialize(faculty) });
}

async function remove(req, res) {
  const id = parseId(req, res); if (!id) return undefined;
  const faculty = await prisma.faculty.findUnique({ where: { id }, include: { _count: { select: { timetableSlots: true, overrides: true } } } });
  if (!faculty) return res.status(404).json({ success: false, error: { code: 'FACULTY_NOT_FOUND', message: 'Faculty member not found' } });
  if (faculty._count.timetableSlots || faculty._count.overrides) return res.status(409).json({ success: false, error: { code: 'FACULTY_IN_USE', message: 'Faculty is referenced by timetable data and cannot be deleted' } });
  await prisma.faculty.delete({ where: { id } });
  logger.audit('FACULTY_DELETED', { facultyId: id, name: faculty.name, adminUserId: req.user.id });
  return res.status(204).send();
}

async function sync(req, res) {
  logger.audit('FACULTY_SYNC_TRIGGERED', { adminUserId: req.user.id });
  try { return res.json({ success: true, data: await facultySync.runFacultySync() }); }
  catch (error) { return res.status(502).json({ success: false, error: { code: 'FACULTY_SYNC_FAILED', message: error.message } }); }
}

async function syncStatus(req, res) {
  return res.json({ success: true, data: await facultySync.getLatestSyncRun() });
}

async function scrapeWeb(req, res) {
  logger.audit('FACULTY_WEB_SCRAPE_TRIGGERED', { adminUserId: req.user.id });
  try {
    const data = await facultyWebScraper.scrapeAndUpdateFaculty({
      facultyId: req.query.facultyId ? Number(req.query.facultyId) : null,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(502).json({ success: false, error: { code: 'FACULTY_WEB_SCRAPE_FAILED', message: error.message } });
  }
}

async function scrapeWebSingle(req, res) {
  const id = parseId(req, res);
  if (!id) return undefined;
  logger.audit('FACULTY_WEB_SCRAPE_SINGLE_TRIGGERED', { facultyId: id, adminUserId: req.user.id });
  try {
    const data = await facultyWebScraper.scrapeAndUpdateFaculty({ facultyId: id });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(502).json({ success: false, error: { code: 'FACULTY_WEB_SCRAPE_FAILED', message: error.message } });
  }
}

async function proxyPdf(req, res) {
  const rawUrl = req.query.url;
  if (!rawUrl) {
    return res.status(400).json({ success: false, error: { code: 'MISSING_URL', message: 'url query parameter is required' } });
  }
  try {
    const parsed = new URL(rawUrl);
    if (!parsed.hostname.includes('griet.ac.in')) {
      return res.status(403).json({ success: false, error: { code: 'INVALID_DOMAIN', message: 'Only GRIET domain URLs can be proxied' } });
    }
    const response = await fetch(rawUrl, {
      signal: AbortSignal.timeout(15000),
      headers: { 'user-agent': 'Timetable-Management-System/1.0' },
    });
    if (!response.ok) {
      return res.status(response.status).json({ success: false, error: { code: 'FETCH_FAILED', message: `Upstream HTTP ${response.status}` } });
    }
    res.set('Content-Type', 'application/pdf');
    const arrayBuffer = await response.arrayBuffer();
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
      const parsed = new URL(url);
      if (!parsed.hostname.includes('griet.ac.in')) {
        return res.status(403).json({ success: false, error: { code: 'INVALID_DOMAIN', message: 'Only GRIET URLs allowed' } });
      }
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      buffer = Buffer.from(await response.arrayBuffer());
    } else {
      return res.status(400).json({ success: false, error: { code: 'MISSING_DATA', message: 'data (base64) or url is required' } });
    }
    const pdf = require('pdf-parse');
    const parsed = await pdf(buffer);
    return res.json({ success: true, text: parsed.text || '' });
  } catch (err) {
    return res.status(502).json({ success: false, error: { code: 'PDF_PARSE_FAILED', message: err.message } });
  }
}

module.exports = { list, getById, create, update, remove, sync, syncStatus, scrapeWeb, scrapeWebSingle, proxyPdf, extractPdfText };
