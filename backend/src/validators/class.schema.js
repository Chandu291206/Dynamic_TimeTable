const { z } = require('zod');

const classSchema = z.object({
  year: z.coerce.number().int().min(1, 'Year must be greater than zero').max(10),
  branch: z.string().trim().min(1, 'Branch is required').max(40),
  section: z.string().trim().min(1, 'Section is required').max(20),
});

module.exports = { classSchema };
