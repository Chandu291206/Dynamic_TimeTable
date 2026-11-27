const { z } = require('zod');
const timetableService = require('../services/timetable.service');
const { parseDate, todayAsIsoDate } = require('../utils/dates');
const { fetchImageBuffer, isAllowedGrietUrl } = require('../utils/imageProxy');

const idSchema = z.coerce.number().int().positive();

async function getClasses(req, res) {
  const classes = await timetableService.listClasses();
  res.json(classes);
}

async function getTimetable(req, res) {
  const parsedId = idSchema.safeParse(req.params.classId);
  if (!parsedId.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Class ID must be a positive integer',
        fields: parsedId.error.flatten().fieldErrors,
      },
    });
  }

  const requestedDate = req.query.date || todayAsIsoDate();
  const date = parseDate(requestedDate);
  if (!date) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Date must use YYYY-MM-DD format',
        fields: { date: ['Date must use YYYY-MM-DD format'] },
      },
    });
  }

  const timetable = await timetableService.getTimetable(parsedId.data, date);
  if (!timetable) {
    return res.status(404).json({ success: false, error: { code: 'CLASS_NOT_FOUND', message: 'Class not found' } });
  }
  return res.json(timetable);
}

async function getWeeklyTimetable(req, res) {
  const parsedId = idSchema.safeParse(req.params.classId);
  if (!parsedId.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Class ID must be a positive integer',
        fields: parsedId.error.flatten().fieldErrors,
      },
    });
  }

  const requestedDate = req.query.date || todayAsIsoDate();
  const date = parseDate(requestedDate);
  if (!date) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Date must use YYYY-MM-DD format',
        fields: { date: ['Date must use YYYY-MM-DD format'] },
      },
    });
  }

  const timetable = await timetableService.getWeeklyTimetable(parsedId.data, date);
  if (!timetable) {
    return res.status(404).json({ success: false, error: { code: 'CLASS_NOT_FOUND', message: 'Class not found' } });
  }
  return res.json(timetable);
}

async function getTimetableJson(req, res) {
  const parsedId = idSchema.safeParse(req.params.classId);
  if (!parsedId.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Class ID must be a positive integer' },
    });
  }

  const timetableJsonService = require('../services/timetable-json.service');
  const json = await timetableJsonService.exportTimetableJson(parsedId.data);
  if (!json) {
    return res.status(404).json({ success: false, error: { code: 'CLASS_NOT_FOUND', message: 'Class not found' } });
  }
  return res.json(json);
}

async function getFacultyImage(req, res) {
  const parsedId = idSchema.safeParse(req.params.id);
  if (!parsedId.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Faculty ID must be a positive integer' } });

  const faculty = await timetableService.getFacultyImage(parsedId.data);
  if (!faculty) {
    return res.status(404).json({ success: false, error: { code: 'IMAGE_NOT_FOUND', message: 'Faculty not found' } });
  }

  // Stream upstream image through HTTPS backend to bypass browser mixed-content / SSL certificate errors
  if (faculty.imageSourceUrl) {
    try {
      const { buffer, contentType } = await fetchImageBuffer(faculty.imageSourceUrl, { enforceGrietDomain: false });
      res.set('X-Content-Type-Options', 'nosniff');
      res.set('Cache-Control', 'public, max-age=86400, s-maxage=604800');
      return res.type(contentType).send(buffer);
    } catch {
      // Upstream image fetch failed; fallback to stored image data if available
    }
  }

  if (faculty.imageData && faculty.imageMimeType) {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'public, max-age=86400, s-maxage=604800');
    return res.type(faculty.imageMimeType).send(faculty.imageData);
  }

  return res.status(404).json({ success: false, error: { code: 'IMAGE_NOT_FOUND', message: 'Faculty image not found' } });
}

async function proxyFacultyAvatar(req, res) {
  const rawUrl = req.query.url;
  if (!rawUrl) {
    return res.status(400).json({ success: false, error: { code: 'MISSING_URL', message: 'url query parameter is required' } });
  }

  if (!isAllowedGrietUrl(rawUrl)) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN_DOMAIN', message: 'Only GRIET HTTP/HTTPS domain images can be proxied' } });
  }

  try {
    const { buffer, contentType } = await fetchImageBuffer(rawUrl, { enforceGrietDomain: true });
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'public, max-age=86400, s-maxage=604800');
    return res.type(contentType).send(buffer);
  } catch (err) {
    return res.status(502).json({ success: false, error: { code: 'PROXY_FAILED', message: err.message } });
  }
}

async function getPeriods(req, res) {
  const prisma = require('../config/database');
  const periods = await prisma.period.findMany({ orderBy: { order: 'asc' } });
  return res.json({ success: true, data: periods });
}

module.exports = {
  getClasses,
  getPeriods,
  getTimetable,
  getWeeklyTimetable,
  getTimetableJson,
  getFacultyImage,
  proxyFacultyAvatar,
};
