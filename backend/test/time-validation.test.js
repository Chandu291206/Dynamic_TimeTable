const test = require('node:test');
const assert = require('node:assert/strict');
const { timeToMinutes } = require('../src/utils/time');

function isValidTimeRange(startTime, endTime) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start === null || end === null) return false;
  return start < end;
}

test('time validation: confirms 09:00 < 10:00 is valid', () => {
  // Plan requirement: 09:00 < 10:00 → valid
  assert.equal(isValidTimeRange('09:00', '10:00'), true);
  assert.equal(timeToMinutes('09:00') < timeToMinutes('10:00'), true);
});

test('time validation: confirms 10:00 < 09:00 is invalid', () => {
  // Plan requirement: 10:00 < 09:00 → invalid
  assert.equal(isValidTimeRange('10:00', '09:00'), false);
  assert.equal(timeToMinutes('10:00') < timeToMinutes('09:00'), false);
});

test('time validation: identical start and end time (zero duration) is invalid', () => {
  assert.equal(isValidTimeRange('09:00', '09:00'), false);
  assert.equal(timeToMinutes('09:00') < timeToMinutes('09:00'), false);
});

test('time validation: boundary times across the academic day', () => {
  assert.equal(isValidTimeRange('08:00', '08:50'), true);
  assert.equal(isValidTimeRange('09:00', '09:50'), true);
  assert.equal(isValidTimeRange('16:30', '17:20'), true);
  assert.equal(isValidTimeRange('17:20', '16:30'), false);
});
