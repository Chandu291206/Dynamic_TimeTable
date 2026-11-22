const test = require('node:test');
const assert = require('node:assert/strict');
const {
  findClashes,
  assertNoClashes,
  detectExistingClashes,
  ClashError,
} = require('../src/services/clash.service');

test('Clash Engine: Passing valid slots without conflicts', () => {
  const candidateSlots = [
    { classId: 1, day: 0, startTime: '09:00', endTime: '09:50', subjectId: 10, facultyId: 101 },
    { classId: 1, day: 0, startTime: '09:50', endTime: '10:40', subjectId: 11, facultyId: 102 },
  ];

  const existingSlots = [
    { id: 1, classId: 2, day: 0, startTime: '09:00', endTime: '09:50', subjectId: 12, facultyId: 103 },
  ];

  const clashes = findClashes({ candidateSlots, existingSlots });
  assert.equal(clashes.length, 0);
  assert.doesNotThrow(() => assertNoClashes({ candidateSlots, existingSlots }));
});

test('Clash Engine: Adjacent slots with touching boundaries do NOT clash', () => {
  const candidateSlots = [
    { classId: 1, day: 1, startTime: '09:00', endTime: '09:50', subjectId: 10, facultyId: 101 },
    { classId: 1, day: 1, startTime: '09:50', endTime: '10:40', subjectId: 11, facultyId: 101 }, // Same faculty, consecutive
  ];

  const clashes = findClashes({ candidateSlots });
  assert.equal(clashes.length, 0, 'Touching boundaries must not trigger CLASS_OVERLAP or FACULTY_DOUBLE_BOOKED');
});

test('Clash Engine: CLASS_OVERLAP within candidate batch', () => {
  const candidateSlots = [
    { classId: 1, day: 2, startTime: '09:00', endTime: '10:00', subjectId: 10, facultyId: 101 },
    { classId: 1, day: 2, startTime: '09:30', endTime: '10:30', subjectId: 11, facultyId: 102 },
  ];

  const clashes = findClashes({ candidateSlots });
  assert.equal(clashes.length, 1);
  assert.equal(clashes[0].type, 'CLASS_OVERLAP');
  assert.throws(() => assertNoClashes({ candidateSlots }), (err) => {
    assert.ok(err instanceof ClashError);
    assert.equal(err.clashes[0].type, 'CLASS_OVERLAP');
    return true;
  });
});

test('Clash Engine: CLASS_OVERLAP candidate vs existing slot', () => {
  const candidateSlots = [
    { classId: 1, day: 3, startTime: '10:40', endTime: '11:30', subjectId: 10, facultyId: 101 },
  ];
  const existingSlots = [
    { id: 99, classId: 1, day: 3, startTime: '10:00', endTime: '11:00', subjectId: 12, facultyId: 103 },
  ];

  const clashes = findClashes({ candidateSlots, existingSlots });
  assert.equal(clashes.length, 1);
  assert.equal(clashes[0].type, 'CLASS_OVERLAP');
  assert.equal(clashes[0].conflictsWith.slotId, 99);
});

test('Clash Engine: FACULTY_DOUBLE_BOOKED across different classes', () => {
  const candidateSlots = [
    { classId: 1, day: 4, startTime: '11:40', endTime: '12:30', subjectId: 10, facultyId: 200 },
  ];
  const existingSlots = [
    { id: 88, classId: 2, classLabel: 'Y3 - CSE - B', day: 4, startTime: '11:40', endTime: '12:30', subjectId: 20, facultyId: 200, faculty: { id: 200, name: 'Dr. Double' } },
  ];

  const clashes = findClashes({ candidateSlots, existingSlots });
  assert.equal(clashes.length, 1);
  assert.equal(clashes[0].type, 'FACULTY_DOUBLE_BOOKED');
  assert.equal(clashes[0].facultyId, 200);
  assert.ok(clashes[0].message.includes('Dr. Double'));
});

test('Clash Engine: FACULTY_DOUBLE_BOOKED Batch B faculty clashes with Batch A of another class', () => {
  const candidateSlots = [
    { classId: 1, day: 1, startTime: '13:45', endTime: '15:25', subjectId: 30, facultyId: 101, batchBFacultyId: 202 },
  ];
  const existingSlots = [
    { id: 77, classId: 3, classLabel: 'Y2 - DS - A', day: 1, startTime: '14:00', endTime: '14:50', subjectId: 31, facultyId: 202 },
  ];

  const clashes = findClashes({ candidateSlots, existingSlots });
  assert.equal(clashes.length, 1);
  assert.equal(clashes[0].type, 'FACULTY_DOUBLE_BOOKED');
  assert.equal(clashes[0].facultyId, 202);
});

test('Clash Engine: Same faculty cannot be assigned as both Batch A and Batch B in the same slot', () => {
  const candidateSlots = [
    { classId: 1, day: 0, startTime: '13:45', endTime: '15:25', subjectId: 30, facultyId: 101, batchBFacultyId: 101 },
  ];

  const clashes = findClashes({ candidateSlots });
  assert.equal(clashes.length, 1);
  assert.equal(clashes[0].type, 'FACULTY_DOUBLE_BOOKED');
  assert.ok(clashes[0].message.includes('both Batch A and Batch B'));
});

test('Clash Engine: Multi-period lab clashes with single-period slot overlapping any part of its duration', () => {
  const candidateSlots = [
    { classId: 1, day: 2, startTime: '13:45', endTime: '15:25', subjectId: 40, facultyId: 301 },
  ];
  const existingSlots = [
    // Overlaps second half of lab
    { id: 55, classId: 2, day: 2, startTime: '14:35', endTime: '15:25', subjectId: 41, facultyId: 301 },
  ];

  const clashes = findClashes({ candidateSlots, existingSlots });
  assert.equal(clashes.length, 1);
  assert.equal(clashes[0].type, 'FACULTY_DOUBLE_BOOKED');
});

test('Clash Engine: Unassigned faculty (T&P / null faculty) never cause faculty clashes', () => {
  const candidateSlots = [
    { classId: 1, day: 3, startTime: '13:45', endTime: '15:25', subjectId: 50, facultyId: null, batchBFacultyId: null },
  ];
  const existingSlots = [
    { id: 66, classId: 2, day: 3, startTime: '13:45', endTime: '15:25', subjectId: 51, facultyId: null },
  ];

  const clashes = findClashes({ candidateSlots, existingSlots });
  assert.equal(clashes.length, 0, 'Null faculty must never trigger faculty double booking');
});

test('Clash Engine: BREAK_HAS_FACULTY triggers when break subject is assigned faculty', () => {
  const candidateSlots = [
    { classId: 1, day: 0, startTime: '12:35', endTime: '13:25', subjectId: 999, facultyId: 101 },
  ];
  const references = {
    subjects: {
      999: { id: 999, name: 'Lunch Break', code: 'LUNCH', isBreak: true },
    },
  };

  const clashes = findClashes({ candidateSlots, references });
  assert.equal(clashes.length, 1);
  assert.equal(clashes[0].type, 'BREAK_HAS_FACULTY');
});

test('Clash Engine: 3-way overlap reporting all conflicts', () => {
  const candidateSlots = [
    { classId: 1, day: 0, startTime: '09:00', endTime: '10:40', subjectId: 10, facultyId: 101 },
  ];
  const existingSlots = [
    { id: 11, classId: 2, classLabel: 'Class 2', day: 0, startTime: '09:00', endTime: '09:50', subjectId: 11, facultyId: 101 },
    { id: 12, classId: 3, classLabel: 'Class 3', day: 0, startTime: '09:50', endTime: '10:40', subjectId: 12, facultyId: 101 },
  ];

  const clashes = findClashes({ candidateSlots, existingSlots });
  assert.equal(clashes.length, 2, 'Must report both conflicts');
  assert.equal(clashes[0].conflictsWith.slotId, 11);
  assert.equal(clashes[1].conflictsWith.slotId, 12);
});

test('Clash Engine: detectExistingClashes identifies mutual overlaps in slot list', () => {
  const slots = [
    { id: 1, classId: 1, classLabel: 'CSE A', day: 1, startTime: '09:00', endTime: '09:50', facultyId: 500, faculty: { id: 500, name: 'Prof. X' } },
    { id: 2, classId: 2, classLabel: 'ECE B', day: 1, startTime: '09:00', endTime: '09:50', facultyId: 500, faculty: { id: 500, name: 'Prof. X' } },
  ];

  const clashes = detectExistingClashes(slots);
  assert.equal(clashes.length, 1);
  assert.equal(clashes[0].type, 'FACULTY_DOUBLE_BOOKED');
  assert.equal(clashes[0].facultyId, 500);
});

test('Clash Engine: OUTSIDE_PERIODS flags off-grid times when enforcePeriods is enabled', () => {
  const periods = [
    { periodNumber: 1, startTime: '09:00', endTime: '09:50' },
    { periodNumber: 2, startTime: '09:50', endTime: '10:40' },
  ];

  const offGridSlot = [
    { classId: 1, day: 0, startTime: '09:15', endTime: '10:05', subjectId: 10, facultyId: 101 },
  ];

  const clashes = findClashes({
    candidateSlots: offGridSlot,
    periods,
    options: { enforcePeriods: true },
  });

  assert.equal(clashes.length, 1);
  assert.equal(clashes[0].type, 'OUTSIDE_PERIODS');
});
