const { z } = require('zod');

const nullableIdSchema = z.union([z.coerce.number().int().positive(), z.null()]);
const managedRoleSchema = z.enum(['CR', 'FACULTY', 'HOD']);

const createCRSchema = z.object({
  username: z.string().trim().min(3).max(100),
  password: z.string().min(6).max(200),
  role: managedRoleSchema.optional().default('CR'),
  classId: nullableIdSchema.optional().default(null),
  facultyId: nullableIdSchema.optional().default(null),
  isActive: z.boolean().optional().default(true),
}).strict().superRefine((data, ctx) => {
  if (data.role === 'CR' && !data.classId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['classId'],
      message: 'Class assignment is required for CR accounts',
    });
  }
  if (data.role === 'FACULTY' && !data.facultyId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['facultyId'],
      message: 'Faculty profile link is required for Faculty accounts',
    });
  }
});

const updateCRSchema = z.object({
  username: z.string().trim().min(3).max(100).optional(),
  password: z.string().min(6).max(200).optional(),
  role: managedRoleSchema.optional(),
  classId: nullableIdSchema.optional(),
  facultyId: nullableIdSchema.optional(),
  isActive: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update');

const assignCRClassSchema = z.object({ classId: nullableIdSchema }).strict();

module.exports = { createCRSchema, updateCRSchema, assignCRClassSchema };
