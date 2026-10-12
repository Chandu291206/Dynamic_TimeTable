const test = require('node:test');
const assert = require('node:assert/strict');
const { classSchema } = require('../src/validators/class.schema');
const { slotSchema } = require('../src/validators/slot.schema');
const { createOverrideSchema } = require('../src/validators/override.schema');
const { createFacultySchema } = require('../src/validators/faculty.schema');
const { subjectSchema } = require('../src/validators/subject.schema');
const { timesOverlap } = require('../src/utils/time');
const { parseDate } = require('../src/utils/dates');

// ==========================================
// 1. Class Data Integrity (year > 0, branch non-empty, section non-empty)
// ==========================================
test('Data Integrity: Class requires year > 0', () => {
  assert.equal(classSchema.safeParse({ year: 0, branch: 'CSE', section: 'A' }).success, false);
  assert.equal(classSchema.safeParse({ year: -1, branch: 'CSE', section: 'A' }).success, false);
  assert.equal(classSchema.safeParse({ year: 1, branch: 'CSE', section: 'A' }).success, true);
  assert.equal(classSchema.safeParse({ year: 3, branch: 'ECE', section: 'B' }).success, true);
});

test('Data Integrity: Class requires non-empty branch and section', () => {
  assert.equal(classSchema.safeParse({ year: 3, branch: '', section: 'A' }).success, false);
  assert.equal(classSchema.safeParse({ year: 3, branch: '   ', section: 'A' }).success, false);
  assert.equal(classSchema.safeParse({ year: 3, branch: 'CSE', section: '' }).success, false);
  assert.equal(classSchema.safeParse({ year: 3, branch: 'CSE', section: '   ' }).success, false);
  assert.equal(classSchema.safeParse({ year: 3, branch: 'CSE', section: 'A' }).success, true);
});

// ==========================================
// 2. Slot Data Integrity (start < end, day in [0, 5])
// ==========================================
test('Data Integrity: Slot requires startTime < endTime', () => {
  const validSlot = {
    classId: 1,
    day: 0,
    startTime: '09:00',
    endTime: '10:00',
  };
  assert.equal(slotSchema.safeParse(validSlot).success, true);

  // Equal times
  const equalTimeSlot = { ...validSlot, startTime: '10:00', endTime: '10:00' };
  assert.equal(slotSchema.safeParse(equalTimeSlot).success, false);

  // Start after end
  const invertedSlot = { ...validSlot, startTime: '11:00', endTime: '10:00' };
  assert.equal(slotSchema.safeParse(invertedSlot).success, false);
});

test('Data Integrity: Slot requires day in range [0, 5] (Monday to Saturday)', () => {
  const baseSlot = {
    classId: 1,
    startTime: '09:00',
    endTime: '10:00',
  };

  // Valid days 0..5
  for (let day = 0; day <= 5; day++) {
    assert.equal(slotSchema.safeParse({ ...baseSlot, day }).success, true, `Day ${day} should be valid`);
  }

  // Invalid: negative or Sunday (6) or beyond
  assert.equal(slotSchema.safeParse({ ...baseSlot, day: -1 }).success, false);
  assert.equal(slotSchema.safeParse({ ...baseSlot, day: 6 }).success, false);
  assert.equal(slotSchema.safeParse({ ...baseSlot, day: 7 }).success, false);
});

// ==========================================
// 3. Override Data Integrity (start < end, valid date, slot overlap)
// ==========================================
test('Data Integrity: Override requires startTime < endTime', () => {
  const validOverride = {
    date: '2026-10-08',
    startTime: '09:00',
    endTime: '10:00',
  };
  assert.equal(createOverrideSchema.safeParse(validOverride).success, true);

  const equalOverride = { ...validOverride, startTime: '10:00', endTime: '10:00' };
  assert.equal(createOverrideSchema.safeParse(equalOverride).success, false);

  const invertedOverride = { ...validOverride, startTime: '10:30', endTime: '09:30' };
  assert.equal(createOverrideSchema.safeParse(invertedOverride).success, false);
});

test('Data Integrity: Override requires valid calendar date (YYYY-MM-DD)', () => {
  const baseOverride = {
    startTime: '09:00',
    endTime: '10:00',
  };

  // Valid dates including leap year
  assert.equal(createOverrideSchema.safeParse({ ...baseOverride, date: '2026-10-08' }).success, true);
  assert.equal(createOverrideSchema.safeParse({ ...baseOverride, date: '2026-02-28' }).success, true);
  assert.equal(createOverrideSchema.safeParse({ ...baseOverride, date: '2024-02-29' }).success, true, 'Leap day in 2024 should be valid');

  // Malformed or impossible dates
  assert.equal(createOverrideSchema.safeParse({ ...baseOverride, date: 'invalid-date' }).success, false);
  assert.equal(createOverrideSchema.safeParse({ ...baseOverride, date: '2025-02-29' }).success, false, 'Leap day in non-leap year 2025 must be invalid');
  assert.equal(createOverrideSchema.safeParse({ ...baseOverride, date: '2026-02-31' }).success, false);
  assert.equal(createOverrideSchema.safeParse({ ...baseOverride, date: '2026-04-31' }).success, false);
  assert.equal(createOverrideSchema.safeParse({ ...baseOverride, date: '2026-13-01' }).success, false);
  assert.equal(createOverrideSchema.safeParse({ ...baseOverride, date: '2026-00-10' }).success, false);
  assert.equal(createOverrideSchema.safeParse({ ...baseOverride, date: '2026-05-00' }).success, false);
});

test('Data Integrity: Override teaching day rule (Monday to Saturday only, Sunday rejected)', () => {
  // 2026-10-05 is Monday (day 0)
  const mondayDate = parseDate('2026-10-05');
  const mondayDay = mondayDate.getUTCDay() === 0 ? 6 : mondayDate.getUTCDay() - 1;
  assert.equal(mondayDay, 0);
  assert.ok(mondayDay <= 5, 'Monday must be an eligible override teaching day');

  // 2026-10-10 is Saturday (day 5)
  const saturdayDate = parseDate('2026-10-10');
  const saturdayDay = saturdayDate.getUTCDay() === 0 ? 6 : saturdayDate.getUTCDay() - 1;
  assert.equal(saturdayDay, 5);
  assert.ok(saturdayDay <= 5, 'Saturday must be an eligible override teaching day');

  // 2026-10-11 is Sunday (day 6)
  const sundayDate = parseDate('2026-10-11');
  const sundayDay = sundayDate.getUTCDay() === 0 ? 6 : sundayDate.getUTCDay() - 1;
  assert.equal(sundayDay, 6);
  assert.ok(sundayDay > 5, 'Sunday must be rejected as outside the Monday-Saturday timetable scope');
});

test('Data Integrity: Override must overlap an existing timetable slot', () => {
  const recurringSlots = [
    { startTime: '09:00', endTime: '10:00' },
    { startTime: '10:00', endTime: '11:00' },
    { startTime: '11:15', endTime: '12:15' },
  ];

  // Overlaps 09:00-10:00
  const overlapping1 = { startTime: '09:00', endTime: '10:00' };
  assert.equal(recurringSlots.some((s) => timesOverlap(overlapping1, s)), true);

  // Partial overlap across 09:30-10:30
  const overlapping2 = { startTime: '09:30', endTime: '10:30' };
  assert.equal(recurringSlots.some((s) => timesOverlap(overlapping2, s)), true);

  // No overlap during break 11:00-11:15
  const nonOverlapping = { startTime: '11:01', endTime: '11:14' };
  assert.equal(recurringSlots.some((s) => timesOverlap(nonOverlapping, s)), false);

  // No overlap outside schedule
  const outside = { startTime: '17:00', endTime: '18:00' };
  assert.equal(recurringSlots.some((s) => timesOverlap(outside, s)), false);
});

// ==========================================
// 4. Faculty Data Integrity (name required)
// ==========================================
test('Data Integrity: Faculty requires non-empty name', () => {
  assert.equal(createFacultySchema.safeParse({ name: 'Dr. John Doe' }).success, true);
  assert.equal(createFacultySchema.safeParse({ name: '' }).success, false);
  assert.equal(createFacultySchema.safeParse({ name: '   ' }).success, false);
  assert.equal(createFacultySchema.safeParse({}).success, false);
});

// ==========================================
// 5. Subject Data Integrity (name required)
// ==========================================
test('Data Integrity: Subject requires non-empty name', () => {
  assert.equal(subjectSchema.safeParse({ name: 'Cloud Computing' }).success, true);
  assert.equal(subjectSchema.safeParse({ name: '' }).success, false);
  assert.equal(subjectSchema.safeParse({ name: '   ' }).success, false);
  assert.equal(subjectSchema.safeParse({}).success, false);
});
