const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { timetableJsonSchema } = require('../src/validators/timetable-json.schema');
const {
  validateTimetableJson,
  parseClassInfo,
} = require('../src/services/timetable-json.service');

test('timetable JSON schema: validates standard canonical timetable JSON successfully', () => {
  const jsonPath = path.join(__dirname, '../src/data/cse1-timetable.json');
  const sampleJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  const result = timetableJsonSchema.safeParse(sampleJson);
  assert.equal(result.success, true);
  assert.equal(result.data.academic_year, '2026-27');
  assert.equal(result.data.branch, 'CSE I');
  assert.equal(result.data.classroom.theory, '1302');
  assert.equal(result.data.working_hours.periods.length, 7);
  assert.equal(result.data.courses.length, 9);
  assert.equal(result.data.academic_calendar.length, 8);
});

test('timetable JSON schema: parses class info from semester and branch', () => {
  assert.deepEqual(parseClassInfo('II Year I Semester', 'CSE I'), {
    year: 2,
    branch: 'CSE',
    section: 'I',
  });

  assert.deepEqual(parseClassInfo('III Year II Semester', 'AIML B'), {
    year: 3,
    branch: 'AIML',
    section: 'B',
  });

  assert.deepEqual(parseClassInfo('IV Year I Semester', 'ECE'), {
    year: 4,
    branch: 'ECE',
    section: 'A',
  });
});

test('timetable JSON schema: rejects JSON missing required working_hours or timetable', () => {
  const invalid = {
    academic_year: '2026-27',
    semester: 'II Year I Semester',
    branch: 'CSE I',
    effective_from: '30-06-2026',
    // Missing working_hours and timetable
  };

  const result = timetableJsonSchema.safeParse(invalid);
  assert.equal(result.success, false);
  const errors = result.error.flatten().fieldErrors;
  assert.ok(errors.working_hours);
  assert.ok(errors.timetable);
});

test('timetable JSON schema: validates faculty as either string or array of faculty items', () => {
  const validString = {
    course_code: 'GR24A3087',
    shortform: 'CN',
    course_name: 'Computer Networks',
    faculty: 'Dr. G. Prasanthi',
    staff_id: '1652',
  };

  const validArray = {
    course_code: 'GR24A3093',
    shortform: 'ML LAB',
    course_name: 'Machine Learning Lab',
    faculty: [
      { name: 'Lohitha Mallireddy', staff_id: '1818' },
      { name: 'K. A. Sathish Kumar', staff_id: '1863' },
    ],
  };

  const { courseDefinitionSchema } = require('../src/validators/timetable-json.schema');
  assert.equal(courseDefinitionSchema.safeParse(validString).success, true);
  assert.equal(courseDefinitionSchema.safeParse(validArray).success, true);
});

test('validateTimetableJson: returns success with valid data and error with invalid data', async () => {
  const jsonPath = path.join(__dirname, '../src/data/cse1-timetable.json');
  const validJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  const validRes = await validateTimetableJson(validJson);
  assert.equal(validRes.success, true);

  const invalidRes = await validateTimetableJson({ invalid: 'data' });
  assert.equal(invalidRes.success, false);
});

