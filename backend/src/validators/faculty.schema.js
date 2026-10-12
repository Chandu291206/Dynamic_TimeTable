const { z } = require('zod');

const nullableText = (max) => z.string().trim().max(max).nullable().optional();
const safeHttpUrl = z.string().trim().max(2048)
  .transform((val) => (val === '' ? null : val))
  .nullable()
  .optional()
  .refine((val) => {
    if (!val) return true;
    try {
      const parsed = new URL(val);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }, { message: 'URL must use HTTP or HTTPS protocol' });

const facultyFields = {
  name: z.string().trim().min(1, 'Name is required').max(160),
  staffId: nullableText(80),
  department: nullableText(160),
  designation: nullableText(160),
  qualification: nullableText(160),
  email: z.string().email().max(254).nullable().optional(),
  phone: nullableText(40),
  imageSourceUrl: safeHttpUrl,
  profileSourceUrl: safeHttpUrl,
};

const createFacultySchema = z.object(facultyFields);
const updateFacultySchema = z.object(Object.fromEntries(Object.entries(facultyFields).map(([key, value]) => [key, key === 'name' ? value.optional() : value])))
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update');

module.exports = { createFacultySchema, updateFacultySchema };
