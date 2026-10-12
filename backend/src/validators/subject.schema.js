const { z } = require('zod');

const subjectSchema = z.object({
  name: z.string().trim().min(1, 'Subject name is required').max(120),
});

module.exports = { subjectSchema };
