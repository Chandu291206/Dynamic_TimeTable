const { z } = require('zod');
const timetableService = require('../services/timetable.service');
const { parseDate, todayAsIsoDate } = require('../utils/dates');

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
  if (!faculty || !faculty.imageData || !faculty.imageMimeType) {
    return res.status(404).json({ success: false, error: { code: 'IMAGE_NOT_FOUND', message: 'Faculty image not found' } });
  }
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Cache-Control', 'public, max-age=86400');
  res.type(faculty.imageMimeType).send(faculty.imageData);
}

module.exports = { getClasses, getTimetable, getWeeklyTimetable, getTimetableJson, getFacultyImage };
