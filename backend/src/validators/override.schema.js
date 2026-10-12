const { z } = require('zod');
const { TIME_PATTERN, timeToMinutes } = require('../utils/time');
const { parseDate } = require('../utils/dates');

const optionalId = z.union([z.coerce.number().int().positive(), z.null()]).optional();

const createOverrideSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format')
    .refine((val) => parseDate(val) !== null, 'Date must be a valid calendar date'),
  startTime: z.string().regex(TIME_PATTERN, 'Start time must use HH:MM format'),
  endTime: z.string().regex(TIME_PATTERN, 'End time must use HH:MM format'),
  subjectId: optionalId,
  facultyId: optionalId,
}).refine((data) => {
  const start = timeToMinutes(data.startTime);
  const end = timeToMinutes(data.endTime);
  return start !== null && end !== null && start < end;
}, {
  message: 'Start time must be before end time',
  path: ['endTime'],
});

module.exports = { createOverrideSchema };
