const test = require('node:test');
const assert = require('node:assert/strict');
const { timeToMinutes, timesOverlap } = require('../src/utils/time');
const { chooseOverride, applyOverrides } = require('../src/services/override.service');

test('converts strict HH:MM times to minutes', () => {
  assert.equal(timeToMinutes('09:00'), 540);
  assert.equal(timeToMinutes('10:30'), 630);
  assert.equal(timeToMinutes('9:00'), null);
});

test('identifies overlapping but not adjacent time ranges', () => {
  assert.equal(timesOverlap({ startTime: '09:00', endTime: '09:50' }, { startTime: '09:20', endTime: '10:00' }), true);
  assert.equal(timesOverlap({ startTime: '09:00', endTime: '09:50' }, { startTime: '09:50', endTime: '10:40' }), false);
});

test('prefers an exact range override over a newer partial override', () => {
  const slot = { startTime: '09:00', endTime: '09:50' };
  const exact = { id: 1, startTime: '09:00', endTime: '09:50', createdAt: '2026-01-01T00:00:00Z' };
  const partial = { id: 2, startTime: '09:30', endTime: '10:00', createdAt: '2026-01-02T00:00:00Z' };
  assert.equal(chooseOverride(slot, [partial, exact]), exact);
});

test('uses the most recently created partial override when no exact match exists', () => {
  const slot = { startTime: '09:00', endTime: '09:50' };
  const older = { id: 1, startTime: '09:10', endTime: '09:40', createdAt: '2026-01-01T00:00:00Z' };
  const newer = { id: 2, startTime: '09:30', endTime: '10:00', createdAt: '2026-01-02T00:00:00Z' };
  assert.equal(applyOverrides([slot], [older, newer])[0].override, newer);
});
