const test = require('node:test');
const assert = require('node:assert/strict');
const { timeToMinutes } = require('../src/utils/time');

test('timeToMinutes converts valid HH:MM times to minutes', () => {
  // Plan requirement: 09:00 → 540
  assert.equal(timeToMinutes('09:00'), 540);

  // Plan requirement: 10:30 → 630
  assert.equal(timeToMinutes('10:30'), 630);

  // Additional boundary cases
  assert.equal(timeToMinutes('00:00'), 0);
  assert.equal(timeToMinutes('12:00'), 720);
  assert.equal(timeToMinutes('23:59'), 1439);
});

test('timeToMinutes rejects invalid or non-standard time strings', () => {
  // Non-padded hours
  assert.equal(timeToMinutes('9:00'), null);
  assert.equal(timeToMinutes('9:30'), null);

  // Out of range hours
  assert.equal(timeToMinutes('24:00'), null);
  assert.equal(timeToMinutes('25:15'), null);

  // Out of range minutes
  assert.equal(timeToMinutes('10:60'), null);
  assert.equal(timeToMinutes('10:99'), null);

  // Non-time strings and wrong types
  assert.equal(timeToMinutes(''), null);
  assert.equal(timeToMinutes('invalid'), null);
  assert.equal(timeToMinutes('10:00:00'), null);
  assert.equal(timeToMinutes(null), null);
  assert.equal(timeToMinutes(undefined), null);
  assert.equal(timeToMinutes(540), null);
});
