const { z } = require('zod');

const subjectSchema = z.object({
  name: z.string().trim().min(1, 'Subject name is required').max(120),
  code: z.string().trim().max(50).optional(),
  isBreak: z.boolean().optional(),
  isActive: z.boolean().optional(),
}).strict();

module.exports = { subjectSchema };
