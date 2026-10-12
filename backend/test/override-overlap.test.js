const test = require('node:test');
const assert = require('node:assert/strict');
const { timesOverlap, sameTimeRange } = require('../src/utils/time');
const { chooseOverride, applyOverrides } = require('../src/services/override.service');

test('override overlap: 09:00-09:50 vs 09:20-10:00 overlaps', () => {
  // Plan requirement:
  // 09:00-09:50
  // 09:20-10:00
  // → overlap
  const slot = { startTime: '09:00', endTime: '09:50' };
  const override = { startTime: '09:20', endTime: '10:00' };

  assert.equal(timesOverlap(slot, override), true);
  assert.equal(timesOverlap(override, slot), true); // symmetric
});

test('override overlap: 09:00-09:50 vs 09:50-10:40 does not overlap', () => {
  // Plan requirement:
  // 09:00-09:50
  // 09:50-10:40
  // → no overlap
  const slot1 = { startTime: '09:00', endTime: '09:50' };
  const slot2 = { startTime: '09:50', endTime: '10:40' };

  assert.equal(timesOverlap(slot1, slot2), false);
  assert.equal(timesOverlap(slot2, slot1), false); // symmetric
});

test('override overlap: identical ranges overlap and match sameTimeRange', () => {
  const slot = { startTime: '09:00', endTime: '09:50' };
  const exact = { startTime: '09:00', endTime: '09:50' };

  assert.equal(timesOverlap(slot, exact), true);
  assert.equal(sameTimeRange(slot, exact), true);
});

test('override overlap: subset and superset ranges overlap', () => {
  const wide = { startTime: '09:00', endTime: '11:30' };
  const narrow = { startTime: '09:50', endTime: '10:40' };

  assert.equal(timesOverlap(wide, narrow), true);
  assert.equal(timesOverlap(narrow, wide), true);
});

test('override overlap: completely disjoint non-adjacent ranges do not overlap', () => {
  const morning = { startTime: '09:00', endTime: '09:50' };
  const afternoon = { startTime: '14:00', endTime: '14:50' };

  assert.equal(timesOverlap(morning, afternoon), false);
});

test('chooseOverride prioritizes exact time match over older or newer partial overrides', () => {
  const slot = { startTime: '09:00', endTime: '09:50' };
  const exact = { id: 10, startTime: '09:00', endTime: '09:50', createdAt: new Date('2026-01-01') };
  const partial = { id: 20, startTime: '09:10', endTime: '10:00', createdAt: new Date('2026-01-02') };

  const chosen = chooseOverride(slot, [partial, exact]);
  assert.equal(chosen.id, 10);
});

test('applyOverrides maps overrides onto corresponding timetable slots', () => {
  const slots = [
    { id: 1, startTime: '09:00', endTime: '09:50', subject: { name: 'CN' } },
    { id: 2, startTime: '09:50', endTime: '10:40', subject: { name: 'AI' } },
  ];
  const overrides = [
    { id: 101, startTime: '09:00', endTime: '09:50', subject: { name: 'SEMINAR' }, createdAt: new Date() },
  ];

  const result = applyOverrides(slots, overrides);
  assert.equal(result.length, 2);
  assert.equal(result[0].override.id, 101);
  assert.equal(result[0].override.subject.name, 'SEMINAR');
  assert.equal(result[1].override, null);
});
