const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const prisma = require('../src/config/database');

let server;
let baseUrl;
let crToken;
let adminToken;
let seededClassId;

async function jsonFetch(path, options = {}) {
  const headers = { ...options.headers };
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
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

  // Authenticate CR
  const crLoginRes = await jsonFetch('/auth/cr/login', {
    method: 'POST',
    body: {
      username: process.env.CR_INITIAL_USERNAME || 'cr1',
      password: process.env.CR_INITIAL_PASSWORD || 'crpass',
    },
  });
  if (crLoginRes.status === 200 && crLoginRes.body?.data?.token) {
    crToken = crLoginRes.body.data.token;
  }

  // Authenticate Admin
  const adminLoginRes = await jsonFetch('/auth/admin/login', {
    method: 'POST',
    body: {
      username: process.env.ADMIN_USERNAME || 'admin',
      password: process.env.ADMIN_PASSWORD || 'adminpass',
    },
  });
  if (adminLoginRes.status === 200 && adminLoginRes.body?.data?.token) {
    adminToken = adminLoginRes.body.data.token;
  }
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await prisma.$disconnect();
});

// ============================================================================
// 1. Public & Operational Endpoints
// ============================================================================

test('GET /api/health returns 200 with active database status and system metrics', async () => {
  const res = await jsonFetch('/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
  assert.equal(res.body.database, 'connected');
  assert.ok(typeof res.body.uptime === 'number');
  assert.ok(res.body.memory?.heapUsedMb >= 0);
});

test('GET /api/classes returns active classes list with standardized labels', async () => {
  const res = await jsonFetch('/classes');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body));
  assert.ok(res.body.length > 0);

  const firstClass = res.body[0];
  assert.ok(firstClass.id);
  assert.ok(firstClass.label);
  assert.ok(firstClass.year);
  assert.ok(firstClass.branch);
  assert.ok(firstClass.section);
  seededClassId = firstClass.id;
});

test('GET /api/timetable/:classId returns class timetable and slots for selected date', async () => {
  assert.ok(seededClassId, 'Seeded class must be available');
  const res = await jsonFetch(`/timetable/${seededClassId}?date=2026-10-05`);
  assert.equal(res.status, 200);
  assert.ok(res.body.class);
  assert.equal(res.body.date, '2026-10-05');
  assert.equal(res.body.day, 0); // Monday
  assert.ok(Array.isArray(res.body.slots));
  assert.ok(res.body.slots.length > 0);
});

// ============================================================================
// 2. Unauthorized Access Protection Matrix
// ============================================================================

test('Protected endpoints reject unauthenticated requests with 401 UNAUTHORIZED', async () => {
  const protectedEndpoints = [
    { method: 'GET', path: '/auth/me' },
    { method: 'GET', path: '/cr/me' },
    { method: 'GET', path: '/cr/dashboard' },
    { method: 'GET', path: '/cr/overrides' },
    { method: 'POST', path: '/cr/overrides', body: {} },
    { method: 'DELETE', path: '/cr/overrides/999' },
    { method: 'GET', path: '/admin/me' },
    { method: 'GET', path: '/admin/faculty' },
    { method: 'POST', path: '/admin/faculty', body: {} },
    { method: 'GET', path: '/admin/subjects' },
    { method: 'POST', path: '/admin/subjects', body: {} },
    { method: 'GET', path: '/admin/classes' },
    { method: 'POST', path: '/admin/classes', body: {} },
    { method: 'GET', path: '/admin/slots' },
    { method: 'POST', path: '/admin/slots', body: {} },
    { method: 'GET', path: '/admin/crs' },
    { method: 'POST', path: '/admin/crs', body: {} },
  ];

  for (const ep of protectedEndpoints) {
    const res = await jsonFetch(ep.path, { method: ep.method, body: ep.body });
    assert.equal(res.status, 401, `Expected 401 for ${ep.method} ${ep.path}, received ${res.status}`);
    assert.equal(res.body?.success, false);
    assert.equal(res.body?.error?.code, 'UNAUTHORIZED');
  }
});

// ============================================================================
// 3. CR Endpoints Integration (Commented out per task 2)
// ============================================================================

test('POST /api/auth/cr/login successfully authenticates CR account', { skip: 'CR login commented out' }, async () => {
  const res = await jsonFetch('/auth/cr/login', {
    method: 'POST',
    body: {
      username: process.env.CR_INITIAL_USERNAME || 'cr1',
      password: process.env.CR_INITIAL_PASSWORD || 'crpass',
    },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data.token);
  assert.equal(res.body.data.user.role, 'CR');
  assert.equal('passwordHash' in res.body.data.user, false);
});

test('GET /api/cr/me returns verified CR profile', { skip: 'CR features commented out' }, async () => {
  assert.ok(crToken, 'CR token must be available');
  const res = await jsonFetch('/cr/me', {
    headers: { authorization: `Bearer ${crToken}` },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.user.role, 'CR');
});

test('GET /api/cr/dashboard returns CR assigned workspace data', { skip: 'CR features commented out' }, async () => {
  assert.ok(crToken, 'CR token must be available');
  const res = await jsonFetch('/cr/dashboard', {
    headers: { authorization: `Bearer ${crToken}` },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data.class);
  assert.ok(Array.isArray(res.body.data.upcomingOverrides));
  assert.ok(Array.isArray(res.body.data.subjects));
  assert.ok(Array.isArray(res.body.data.faculty));
});

test('POST /api/cr/overrides & GET /api/cr/overrides manages timetable overrides', { skip: 'CR features commented out' }, async () => {
  assert.ok(crToken, 'CR token must be available');
  const crHeaders = { authorization: `Bearer ${crToken}` };

  // 1. Get initial overrides list
  const initialRes = await jsonFetch('/cr/overrides', { headers: crHeaders });
  assert.equal(initialRes.status, 200);
  assert.equal(initialRes.body.success, true);
  assert.ok(Array.isArray(initialRes.body.data));

  // 2. Create test override on a Monday (2030-01-07)
  const createRes = await jsonFetch('/cr/overrides', {
    method: 'POST',
    headers: crHeaders,
    body: {
      date: '2030-01-07',
      startTime: '09:00',
      endTime: '09:50',
    },
  });

  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.success, true);
  const createdOverrideId = createRes.body.data.id;
  assert.ok(createdOverrideId);

  try {
    // 3. Confirm override appears in upcoming list
    const updatedRes = await jsonFetch('/cr/overrides?days=30', { headers: crHeaders });
    assert.equal(updatedRes.status, 200);
  } finally {
    // 4. Clean up override
    const delRes = await jsonFetch(`/cr/overrides/${createdOverrideId}`, {
      method: 'DELETE',
      headers: crHeaders,
    });
    assert.equal(delRes.status, 204);
  }
});

test('CR token is denied access to admin endpoints with 403 FORBIDDEN', { skip: 'CR features commented out' }, async () => {
  assert.ok(crToken, 'CR token must be available');
  const res = await jsonFetch('/admin/faculty', {
    headers: { authorization: `Bearer ${crToken}` },
  });

  assert.equal(res.status, 403);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'FORBIDDEN');
});

// ============================================================================
// 4. Admin Endpoints Integration
// ============================================================================

test('POST /api/auth/admin/login successfully authenticates administrator', async () => {
  const res = await jsonFetch('/auth/admin/login', {
    method: 'POST',
    body: {
      username: process.env.ADMIN_USERNAME || 'admin',
      password: process.env.ADMIN_PASSWORD || 'adminpass',
    },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data.token);
  assert.equal(res.body.data.user.role, 'ADMIN');
});

test('GET /api/admin/faculty & POST /api/admin/faculty manages faculty records', async () => {
  assert.ok(adminToken, 'Admin token must be available');
  const adminHeaders = { authorization: `Bearer ${adminToken}` };

  const listRes = await jsonFetch('/admin/faculty', { headers: adminHeaders });
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.success, true);
  assert.ok(Array.isArray(listRes.body.data));

  const testStaffId = `T${Date.now().toString().slice(-6)}`;
  const createRes = await jsonFetch('/admin/faculty', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      name: 'Integration Test Faculty',
      staffId: testStaffId,
      department: 'CSE',
      designation: 'Professor',
    },
  });

  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.success, true);
  const facultyId = createRes.body.data.id;

  // Clean up
  const delRes = await jsonFetch(`/admin/faculty/${facultyId}`, {
    method: 'DELETE',
    headers: adminHeaders,
  });
  assert.equal(delRes.status, 204);
});

test('GET /api/admin/subjects & POST /api/admin/subjects manages subject records', async () => {
  assert.ok(adminToken, 'Admin token must be available');
  const adminHeaders = { authorization: `Bearer ${adminToken}` };

  const listRes = await jsonFetch('/admin/subjects', { headers: adminHeaders });
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.success, true);
  assert.ok(Array.isArray(listRes.body.data));

  const testSubjectName = `SUB_${Date.now().toString().slice(-6)}`;
  const createRes = await jsonFetch('/admin/subjects', {
    method: 'POST',
    headers: adminHeaders,
    body: { name: testSubjectName },
  });

  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.success, true);
  const subjectId = createRes.body.data.id;

  // Clean up
  const delRes = await jsonFetch(`/admin/subjects/${subjectId}`, {
    method: 'DELETE',
    headers: adminHeaders,
  });
  assert.equal(delRes.status, 204);
});

test('GET /api/admin/classes & POST /api/admin/classes manages class records', async () => {
  assert.ok(adminToken, 'Admin token must be available');
  const adminHeaders = { authorization: `Bearer ${adminToken}` };

  const listRes = await jsonFetch('/admin/classes', { headers: adminHeaders });
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.success, true);
  assert.ok(Array.isArray(listRes.body.data));

  const testSection = `Z${Date.now().toString().slice(-4)}`;
  const createRes = await jsonFetch('/admin/classes', {
    method: 'POST',
    headers: adminHeaders,
    body: { year: 4, branch: 'IT', section: testSection },
  });

  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.success, true);
  const classId = createRes.body.data.id;

  // Clean up
  const delRes = await jsonFetch(`/admin/classes/${classId}`, {
    method: 'DELETE',
    headers: adminHeaders,
  });
  assert.equal(delRes.status, 204);
});

test('GET /api/admin/slots & POST /api/admin/slots manages recurring slots', async () => {
  assert.ok(adminToken, 'Admin token must be available');
  const adminHeaders = { authorization: `Bearer ${adminToken}` };

  const listRes = await jsonFetch('/admin/slots', { headers: adminHeaders });
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.success, true);
  assert.ok(Array.isArray(listRes.body.data));

  // Create temporary class to attach a slot
  const testSection = `S${Date.now().toString().slice(-4)}`;
  const classRes = await jsonFetch('/admin/classes', {
    method: 'POST',
    headers: adminHeaders,
    body: { year: 2, branch: 'ECE', section: testSection },
  });
  assert.equal(classRes.status, 201);
  const classId = classRes.body.data.id;

  try {
    const createSlotRes = await jsonFetch('/admin/slots', {
      method: 'POST',
      headers: adminHeaders,
      body: {
        classId,
        day: 0,
        startTime: '09:00',
        endTime: '09:50',
      },
    });

    assert.equal(createSlotRes.status, 201);
    assert.equal(createSlotRes.body.success, true);
    const slotId = createSlotRes.body.data.id;

    // Clean up slot
    const delSlotRes = await jsonFetch(`/admin/slots/${slotId}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    assert.equal(delSlotRes.status, 204);
  } finally {
    // Clean up class
    await jsonFetch(`/admin/classes/${classId}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
  }
});

test('DELETE /api/admin/classes/:id/timetable clears timetable and DELETE /classes/:id deletes class with slots', async () => {
  assert.ok(adminToken, 'Admin token must be available');
  const adminHeaders = { authorization: `Bearer ${adminToken}` };

  // Create temporary class
  const testSection = `TT${Date.now().toString().slice(-4)}`;
  const classRes = await jsonFetch('/admin/classes', {
    method: 'POST',
    headers: adminHeaders,
    body: { year: 3, branch: 'AIML', section: testSection },
  });
  assert.equal(classRes.status, 201);
  const classId = classRes.body.data.id;

  // Add slot to class
  const slotRes = await jsonFetch('/admin/slots', {
    method: 'POST',
    headers: adminHeaders,
    body: { classId, day: 1, startTime: '10:00', endTime: '10:50' },
  });
  assert.equal(slotRes.status, 201);

  // Clear timetable
  const clearRes = await jsonFetch(`/admin/classes/${classId}/timetable`, {
    method: 'DELETE',
    headers: adminHeaders,
  });
  assert.equal(clearRes.status, 200);
  assert.equal(clearRes.body.success, true);
  assert.equal(clearRes.body.data.clearedSlots, 1);

  // Add another slot
  await jsonFetch('/admin/slots', {
    method: 'POST',
    headers: adminHeaders,
    body: { classId, day: 2, startTime: '11:00', endTime: '11:50' },
  });

  // Delete class directly with slots - should successfully cascade delete
  const delClassRes = await jsonFetch(`/admin/classes/${classId}`, {
    method: 'DELETE',
    headers: adminHeaders,
  });
  assert.equal(delClassRes.status, 204);
});

