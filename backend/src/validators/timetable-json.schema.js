const { z } = require('zod');

const periodDefinitionSchema = z.object({
  period: z.number().int().positive(),
  time: z.string().trim().min(5),
});

const workingHoursSchema = z.object({
  periods: z.array(periodDefinitionSchema).min(1, 'At least one period definition is required'),
  lunch: z.string().trim().min(5),
});

const timetableItemSchema = z.object({
  time: z.string().trim().min(5),
  periods: z.array(z.number().int().positive()).optional(),
  subject: z.string().trim().min(1),
});

const facultyItemSchema = z.object({
  name: z.string().trim().min(1),
  staff_id: z.string().trim().optional(),
});

const courseDefinitionSchema = z.object({
  course_code: z.string().trim().min(1),
  shortform: z.string().trim().min(1),
  course_name: z.string().trim().min(1),
  faculty: z.union([z.string().trim(), z.array(facultyItemSchema)]),
  staff_id: z.string().trim().optional(),
});

const academicCalendarItemSchema = z.object({
  event: z.string().trim().min(1),
  date: z.string().trim().optional(),
  start_date: z.string().trim().optional(),
  end_date: z.string().trim().optional(),
  duration: z.string().trim().optional(),
  deadline: z.string().trim().optional(),
});

const classroomDetailsSchema = z.object({
  theory: z.union([z.string().trim(), z.record(z.string())]).optional(),
  labs: z.record(z.string()).optional(),
  class_coordinator: z.string().trim().optional(),
  year_coordinator: z.string().trim().optional(),
});

const timetableJsonSchema = z.object({
  academic_year: z.string().trim().min(4),
  semester: z.string().trim().min(2),
  branch: z.string().trim().min(2),
  effective_from: z.string().trim().min(4),
  classroom: classroomDetailsSchema.optional(),
  working_hours: workingHoursSchema,
  timetable: z.record(z.array(timetableItemSchema)),
  courses: z.array(courseDefinitionSchema).default([]),
  academic_calendar: z.array(academicCalendarItemSchema).default([]),
});

module.exports = {
  timetableJsonSchema,
  workingHoursSchema,
  timetableItemSchema,
  courseDefinitionSchema,
  academicCalendarItemSchema,
};
