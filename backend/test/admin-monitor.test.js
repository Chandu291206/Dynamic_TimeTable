const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const { resolveSlotRoom } = require('../src/utils/room-resolver');

let server;
let baseUrl;
let adminToken;

async function jsonFetch(path, options = {}) {
  const headers = { ...options.headers };
  if (options.body && typeof options.body === 'object') {
    headers['content-type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const contentType = response.headers.get('content-type') || '';
  let body = null;
  if (contentType.includes('application/json')) {
    try {
      body = await response.json();
    } catch {
      body = null;
    }
  }
  return { status: response.status, body, headers: response.headers };
}

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  const adminLoginRes = await jsonFetch('/auth/admin/login', {
    method: 'POST',
    body: {
      username: process.env.ADMIN_USERNAME || 'admin',
      password: process.env.ADMIN_PASSWORD || 'adminpass',
    },
  });
  adminToken = adminLoginRes.body?.data?.token;
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('resolveSlotRoom: prioritizes explicit slot room', () => {
  const slot = { room: 'Room 1302', subject: { code: 'DBMS' } };
  const meta = { classroom: { theory: '2203', labs: { DBMS: '2101' } } };
  assert.equal(resolveSlotRoom(slot, meta, 'Monday'), 'Room 1302');
});

test('resolveSlotRoom: maps lab rooms from subject code', () => {
  const slot = { room: null, subject: { code: 'JP LAB' } };
  const meta = { classroom: { theory: '2203', labs: { 'JP LAB': '2309/10' } } };
  assert.equal(resolveSlotRoom(slot, meta, 'Monday'), 'Lab 2309/10');
});

test('resolveSlotRoom: maps day-specific theory rooms', () => {
  const slot = { room: null, subject: { code: 'COA' } };
  const meta = { classroom: { theory: { Monday: '2409', Tuesday: '2203' } } };
  assert.equal(resolveSlotRoom(slot, meta, 'Monday'), 'Room 2409');
  assert.equal(resolveSlotRoom(slot, meta, 'Tuesday'), 'Room 2203');
});

test('resolveSlotRoom: falls back to general theory room and TBA', () => {
  const slot = { room: null, subject: { code: 'EAE' } };
  const meta = { classroom: { theory: '3104' } };
  assert.equal(resolveSlotRoom(slot, meta, 'Wednesday'), 'Room 3104');
  assert.equal(resolveSlotRoom(slot, null, 'Wednesday'), 'TBA');
});

test('GET /api/admin/monitor/live: rejects unauthenticated requests', async () => {
  const res = await jsonFetch('/admin/monitor/live');
  assert.equal(res.status, 401);
});

test('GET /api/admin/monitor/live: returns 200 with live monitoring data for admin', async () => {
  const res = await jsonFetch('/admin/monitor/live?date=2026-10-05&time=10:00', {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data.summary);
  assert.ok(Array.isArray(res.body.data.liveSessions));
  assert.ok(Array.isArray(res.body.data.roomOccupancy));
  assert.ok(Array.isArray(res.body.data.periods));
});

test('GET /api/admin/monitor/live: validates bad time format', async () => {
  const res = await jsonFetch('/admin/monitor/live?date=2026-10-05&time=99:99', {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
});

test('GET /api/admin/monitor/master-matrix: returns 200 with grouped years and week schedules', async () => {
  const res = await jsonFetch('/admin/monitor/master-matrix', {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data.years);
  assert.ok(res.body.data.years['2']);
  assert.ok(Array.isArray(res.body.data.periods));
});
