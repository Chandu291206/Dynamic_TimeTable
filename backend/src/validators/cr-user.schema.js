const { z } = require('zod');

const classIdSchema = z.union([z.coerce.number().int().positive(), z.null()]);

const createCRSchema = z.object({
  username: z.string().trim().min(3).max(100),
  password: z.string().min(6).max(200),
  classId: z.coerce.number().int().positive(),
  isActive: z.boolean().optional().default(true),
});

const updateCRSchema = z.object({
  username: z.string().trim().min(3).max(100).optional(),
  password: z.string().min(6).max(200).optional(),
  isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update');

const assignCRClassSchema = z.object({ classId: classIdSchema });

module.exports = { createCRSchema, updateCRSchema, assignCRClassSchema };
