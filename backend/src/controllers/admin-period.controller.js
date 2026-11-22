const { z } = require('zod');
const prisma = require('../config/database');
const { TIME_PATTERN } = require('../utils/time');
const logger = require('../utils/logger');

const periodUpdateSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  startTime: z.string().regex(TIME_PATTERN, 'Start time must be strict HH:MM').optional(),
  endTime: z.string().regex(TIME_PATTERN, 'End time must be strict HH:MM').optional(),
  isBreak: z.boolean().optional(),
});

async function list(req, res) {
  const periods = await prisma.period.findMany({ orderBy: { order: 'asc' } });
  return res.json({ success: true, data: periods });
}

async function update(req, res) {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid period ID' } });
  }

  const parsed = periodUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid period data', fields: parsed.error.flatten().fieldErrors },
    });
  }

  const existing = await prisma.period.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ success: false, error: { code: 'PERIOD_NOT_FOUND', message: 'Period not found' } });
  }

  const updated = await prisma.period.update({
    where: { id },
    data: parsed.data,
  });

  logger.audit('PERIOD_UPDATED', {
    periodId: id,
    name: updated.name,
    startTime: updated.startTime,
    endTime: updated.endTime,
    adminUserId: req.user.id,
  });

  return res.json({ success: true, data: updated });
}

module.exports = { list, update };
