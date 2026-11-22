const { z } = require('zod');
const { TIME_PATTERN, timeToMinutes } = require('../utils/time');

const optionalId = z.union([z.coerce.number().int().positive(), z.null()]).optional();

const createDraftSchema = z.object({
  classId: z.coerce.number().int().positive('Class ID must be a positive integer'),
  startFrom: z.enum(['published', 'blank']).default('published'),
  name: z.string().trim().max(120).optional(),
}).strict();

const updateCellSchema = z.object({
  day: z.coerce.number().int().min(0, 'Day must be 0..5').max(5, 'Day must be 0..5'),
  startTime: z.string().regex(TIME_PATTERN, 'Start time must use HH:MM format'),
  endTime: z.string().regex(TIME_PATTERN, 'End time must use HH:MM format'),
  room: z.string().trim().max(50).nullable().optional(),
  startPeriodId: optionalId,
  endPeriodId: optionalId,
  subjectId: optionalId,
  facultyId: optionalId,
  batchBFacultyId: optionalId,
  expectedVersion: z.coerce.number().int().positive().optional(),
}).strict().refine((data) => {
  const start = timeToMinutes(data.startTime);
  const end = timeToMinutes(data.endTime);
  return start !== null && end !== null && start < end;
}, {
  message: 'Start time must be before end time',
  path: ['endTime'],
});

const clearCellSchema = z.object({
  day: z.coerce.number().int().min(0).max(5),
  startTime: z.string().regex(TIME_PATTERN),
  expectedVersion: z.coerce.number().int().positive().optional(),
}).strict();

module.exports = {
  createDraftSchema,
  updateCellSchema,
  clearCellSchema,
};
