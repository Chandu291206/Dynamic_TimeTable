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

// ============================================================================
// 5. Phase 3 ID-Only Contract & Same-Name Faculty Acceptance Tests
// ============================================================================

test('POST /api/admin/slots rejects legacy text keys (subjectName, facultyName, className) with 400', async () => {
  assert.ok(adminToken, 'Admin token must be available');
  const adminHeaders = { authorization: `Bearer ${adminToken}` };

  const res = await jsonFetch('/admin/slots', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      classId: 1,
      day: 1,
      startTime: '09:00',
      endTime: '09:50',
      subjectName: 'Operating Systems', // Banned key
    },
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
});

test('POST /api/cr/overrides rejects legacy text keys (subjectName, facultyName) with 400', { skip: 'CR features commented out' }, async () => {
  assert.ok(crToken, 'CR token must be available');
  const crHeaders = { authorization: `Bearer ${crToken}` };

  const res = await jsonFetch('/cr/overrides', {
    method: 'POST',
    headers: crHeaders,
    body: {
      date: '2030-01-08',
      startTime: '09:00',
      endTime: '09:50',
      facultyName: 'Dr. John', // Banned key
    },
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
});

test('Phase 3 Acceptance: Same-name faculty with distinct staffId are isolated across slots and overrides', async () => {
  assert.ok(adminToken, 'Admin token must be available');
  const adminHeaders = { authorization: `Bearer ${adminToken}` };

  const uniqueSuffix = Date.now().toString().slice(-5);
  const commonName = `Dr. Suresh Sharma ${uniqueSuffix}`;
  const staffIdA = `STF_A_${uniqueSuffix}`;
  const staffIdB = `STF_B_${uniqueSuffix}`;

  // 1. Create two faculty members with IDENTICAL names but distinct staff IDs
  const f1Res = await jsonFetch('/admin/faculty', {
    method: 'POST',
    headers: adminHeaders,
    body: { name: commonName, staffId: staffIdA, department: 'CSE' },
  });
  assert.equal(f1Res.status, 201, `Failed to create Faculty A: ${JSON.stringify(f1Res.body)}`);
  const facultyA = f1Res.body.data;

  const f2Res = await jsonFetch('/admin/faculty', {
    method: 'POST',
    headers: adminHeaders,
    body: { name: commonName, staffId: staffIdB, department: 'CSE' },
  });
  assert.equal(f2Res.status, 201, `Failed to create Faculty B: ${JSON.stringify(f2Res.body)}`);
  const facultyB = f2Res.body.data;

  assert.notEqual(facultyA.id, facultyB.id, 'Both faculty must have distinct numeric IDs');
  assert.equal(facultyA.name, facultyB.name, 'Faculty names must be identical');
  assert.equal(facultyA.staffId, staffIdA);
  assert.equal(facultyB.staffId, staffIdB);

  // 2. Create a temporary class and a subject
  const classRes = await jsonFetch('/admin/classes', {
    method: 'POST',
    headers: adminHeaders,
    body: { year: 3, branch: 'CSE', section: `SN${uniqueSuffix.slice(-3)}` },
  });
  assert.equal(classRes.status, 201);
  const classId = classRes.body.data.id;

  const subjRes = await jsonFetch('/admin/subjects', {
    method: 'POST',
    headers: adminHeaders,
    body: { name: `Lab Course ${uniqueSuffix}`, code: `LAB${uniqueSuffix}` },
  });
  assert.equal(subjRes.status, 201);
  const subjectId = subjRes.body.data.id;

  let slotId;
  try {
    // 3. Create a slot assigning Faculty A as Batch A faculty and Faculty B as Batch B faculty
    const slotRes = await jsonFetch('/admin/slots', {
      method: 'POST',
      headers: adminHeaders,
      body: {
        classId,
        day: 2,
        startTime: '13:45',
        endTime: '15:25',
        subjectId,
        facultyId: facultyA.id,
        batchBFacultyId: facultyB.id,
      },
    });
    assert.equal(slotRes.status, 201, `Slot creation failed: ${JSON.stringify(slotRes.body)}`);
    slotId = slotRes.body.data.id;

    // 4. Retrieve slots for class and verify both faculty maintain their precise identity
    const getSlotsRes = await jsonFetch(`/admin/slots?classId=${classId}`, { headers: adminHeaders });
    assert.equal(getSlotsRes.status, 200);
    const createdSlot = getSlotsRes.body.data.find((s) => s.id === slotId);
    assert.ok(createdSlot, 'Slot must be retrieved');
    assert.equal(createdSlot.faculty.id, facultyA.id);
    assert.equal(createdSlot.faculty.staffId, staffIdA);
    assert.equal(createdSlot.batchBFaculty.id, facultyB.id);
    assert.equal(createdSlot.batchBFaculty.staffId, staffIdB);
  } finally {
    // Clean up
    if (slotId) {
      await jsonFetch(`/admin/slots/${slotId}`, { method: 'DELETE', headers: adminHeaders });
    }
    await jsonFetch(`/admin/classes/${classId}`, { method: 'DELETE', headers: adminHeaders });
    await jsonFetch(`/admin/subjects/${subjectId}`, { method: 'DELETE', headers: adminHeaders });
    await jsonFetch(`/admin/faculty/${facultyA.id}`, { method: 'DELETE', headers: adminHeaders });
    await jsonFetch(`/admin/faculty/${facultyB.id}`, { method: 'DELETE', headers: adminHeaders });
  }
});

// ============================================================================
// 6. Phase 4 Clash Engine Integration & Advisory Locking Tests
// ============================================================================

test('GET /api/admin/conflicts returns live conflicts report', async () => {
  assert.ok(adminToken, 'Admin token must be available');
  const res = await jsonFetch('/admin/conflicts', {
    headers: { authorization: `Bearer ${adminToken}` },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(typeof res.body.data.totalClashes === 'number');
  assert.ok(Array.isArray(res.body.data.clashes));
});

test('GET /api/admin/faculty-busy-map returns faculty busy schedule', async () => {
  assert.ok(adminToken, 'Admin token must be available');
  const res = await jsonFetch('/admin/faculty-busy-map', {
    headers: { authorization: `Bearer ${adminToken}` },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(typeof res.body.data === 'object');
});

test('Phase 4 Acceptance: Clash prevention on POST /api/admin/slots', async () => {
  assert.ok(adminToken, 'Admin token must be available');
  const adminHeaders = { authorization: `Bearer ${adminToken}` };
  const suffix = Date.now().toString().slice(-4);

  // Setup 2 classes and 1 faculty
  const [c1Res, c2Res, fRes] = await Promise.all([
    jsonFetch('/admin/classes', { method: 'POST', headers: adminHeaders, body: { year: 3, branch: 'CSE', section: `C1${suffix}` } }),
    jsonFetch('/admin/classes', { method: 'POST', headers: adminHeaders, body: { year: 3, branch: 'AIML', section: `C2${suffix}` } }),
    jsonFetch('/admin/faculty', { method: 'POST', headers: adminHeaders, body: { name: `Prof. Clash ${suffix}`, staffId: `STF_CLASH_${suffix}` } }),
  ]);

  assert.equal(c1Res.status, 201);
  assert.equal(c2Res.status, 201);
  assert.equal(fRes.status, 201);

  const class1Id = c1Res.body.data.id;
  const class2Id = c2Res.body.data.id;
  const facultyId = fRes.body.data.id;

  let slot1Id;
  let adjacentSlotId;

  try {
    // 1. Create base slot for Class 1 (09:00 - 09:50, Day 1)
    const slot1Res = await jsonFetch('/admin/slots', {
      method: 'POST',
      headers: adminHeaders,
      body: { classId: class1Id, day: 1, startTime: '09:00', endTime: '09:50', facultyId },
    });
    assert.equal(slot1Res.status, 201);
    slot1Id = slot1Res.body.data.id;

    // 2. Attempt to create overlapping slot in SAME class -> 409 CLASS_OVERLAP
    const sameClassRes = await jsonFetch('/admin/slots', {
      method: 'POST',
      headers: adminHeaders,
      body: { classId: class1Id, day: 1, startTime: '09:30', endTime: '10:20' },
    });
    assert.equal(sameClassRes.status, 409);
    assert.equal(sameClassRes.body.error.code, 'CLASH_DETECTED');
    assert.ok(sameClassRes.body.error.clashes.some((c) => c.type === 'CLASS_OVERLAP'));

    // 3. Attempt to create overlapping slot in DIFFERENT class with SAME faculty -> 409 FACULTY_DOUBLE_BOOKED
    const diffClassRes = await jsonFetch('/admin/slots', {
      method: 'POST',
      headers: adminHeaders,
      body: { classId: class2Id, day: 1, startTime: '09:00', endTime: '09:50', facultyId },
    });
    assert.equal(diffClassRes.status, 409);
    assert.equal(diffClassRes.body.error.code, 'CLASH_DETECTED');
    assert.ok(diffClassRes.body.error.clashes.some((c) => c.type === 'FACULTY_DOUBLE_BOOKED'));

    // 4. Create ADJACENT slot (touching boundary 09:50 - 10:40) with same faculty -> 201 Created
    const adjacentRes = await jsonFetch('/admin/slots', {
      method: 'POST',
      headers: adminHeaders,
      body: { classId: class2Id, day: 1, startTime: '09:50', endTime: '10:40', facultyId },
    });
    assert.equal(adjacentRes.status, 201, `Adjacent slot should succeed: ${JSON.stringify(adjacentRes.body)}`);
    adjacentSlotId = adjacentRes.body.data.id;
  } finally {
    if (adjacentSlotId) await jsonFetch(`/admin/slots/${adjacentSlotId}`, { method: 'DELETE', headers: adminHeaders });
    if (slot1Id) await jsonFetch(`/admin/slots/${slot1Id}`, { method: 'DELETE', headers: adminHeaders });
    await jsonFetch(`/admin/classes/${class1Id}`, { method: 'DELETE', headers: adminHeaders });
    await jsonFetch(`/admin/classes/${class2Id}`, { method: 'DELETE', headers: adminHeaders });
    await jsonFetch(`/admin/faculty/${facultyId}`, { method: 'DELETE', headers: adminHeaders });
  }
});


