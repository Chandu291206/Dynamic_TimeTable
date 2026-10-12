const { z } = require('zod');
const { TIME_PATTERN, timeToMinutes } = require('../utils/time');

const optionalId = z.union([z.coerce.number().int().positive(), z.null()]).optional();

const slotSchema = z.object({
  classId: z.coerce.number().int().positive('Class ID must be a positive integer'),
  day: z.coerce.number().int().min(0, 'Day must be between 0 (Monday) and 5 (Saturday)').max(5, 'Day must be between 0 (Monday) and 5 (Saturday)'),
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

module.exports = { slotSchema };
