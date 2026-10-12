const test = require('node:test');
const assert = require('node:assert/strict');
const { parseDate, getTimetableDay, todayAsIsoDate } = require('../src/utils/dates');

test('date → weekday: maps Monday to day index 0', () => {
  // 2026-10-05 is a Monday
  const date = parseDate('2026-10-05');
  assert.ok(date);
  assert.equal(getTimetableDay(date), 0);
});

test('date → weekday: maps Tuesday to day index 1', () => {
  // 2026-10-06 is a Tuesday
  const date = parseDate('2026-10-06');
  assert.ok(date);
  assert.equal(getTimetableDay(date), 1);
});

test('date → weekday: maps Wednesday to day index 2', () => {
  // 2026-10-07 is a Wednesday
  const date = parseDate('2026-10-07');
  assert.ok(date);
  assert.equal(getTimetableDay(date), 2);
});

test('date → weekday: maps Thursday to day index 3', () => {
  // 2026-10-08 is a Thursday
  const date = parseDate('2026-10-08');
  assert.ok(date);
  assert.equal(getTimetableDay(date), 3);
});

test('date → weekday: maps Friday to day index 4', () => {
  // 2026-10-09 is a Friday
  const date = parseDate('2026-10-09');
  assert.ok(date);
  assert.equal(getTimetableDay(date), 4);
});

test('date → weekday: maps Saturday to day index 5', () => {
  // 2026-10-10 is a Saturday
  const date = parseDate('2026-10-10');
  assert.ok(date);
  assert.equal(getTimetableDay(date), 5);
});

test('date → weekday: maps Sunday to day index 6 (non-teaching / holiday)', () => {
  // 2026-10-11 is a Sunday
  const date = parseDate('2026-10-11');
  assert.ok(date);
  assert.equal(getTimetableDay(date), 6);
});

test('parseDate: accepts valid YYYY-MM-DD dates with zero-padded months and days', () => {
  const parsed = parseDate('2026-03-15');
  assert.ok(parsed instanceof Date);
  assert.equal(parsed.toISOString().slice(0, 10), '2026-03-15');
});

test('parseDate: rejects invalid dates, malformed formats, and impossible calendar dates', () => {
  assert.equal(parseDate('2026-02-30'), null); // Impossible February date
  assert.equal(parseDate('2026-13-01'), null); // Month 13
  assert.equal(parseDate('2026-00-10'), null); // Month 00
  assert.equal(parseDate('2026-04-31'), null); // April only has 30 days
  assert.equal(parseDate('05-10-2026'), null); // Wrong order
  assert.equal(parseDate('2026/10/05'), null); // Slashes
  assert.equal(parseDate(''), null);
  assert.equal(parseDate(null), null);
  assert.equal(parseDate(undefined), null);
});

test('todayAsIsoDate produces valid YYYY-MM-DD string', () => {
  const today = todayAsIsoDate();
  assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(parseDate(today));
});

test('weekly range: Monday to Saturday span matches 6 teaching days', () => {
  // Reference date: Wednesday 2026-10-07
  const ref = parseDate('2026-10-07');
  const dayOfWeek = ref.getUTCDay(); // 3 (Wednesday)
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // -2
  const monday = new Date(ref);
  monday.setUTCDate(ref.getUTCDate() + diffToMonday);
  assert.equal(monday.toISOString().slice(0, 10), '2026-10-05');

  const saturday = new Date(monday);
  saturday.setUTCDate(monday.getUTCDate() + 5);
  assert.equal(saturday.toISOString().slice(0, 10), '2026-10-10');
});
