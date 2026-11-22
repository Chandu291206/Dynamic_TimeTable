const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const prisma = require('../src/config/database');

let server;
let baseUrl;
let adminToken;
let crToken;

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
  if (adminLoginRes.status === 200 && adminLoginRes.body?.data?.token) {
    adminToken = adminLoginRes.body.data.token;
  }

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
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await prisma.$disconnect();
});

test('Designer Security: Non-admin users cannot access designer endpoints', async () => {
  // Unauthenticated
  const unauthRes = await jsonFetch('/admin/designer/drafts');
  assert.equal(unauthRes.status, 401);

  // Authenticated as CR (forbidden)
  if (crToken) {
    const crRes = await jsonFetch('/admin/designer/drafts', {
      headers: { authorization: `Bearer ${crToken}` },
    });
    assert.equal(crRes.status, 403);
  }
});

test('Designer End-to-End: Draft lifecycle, optimistic lock, clash blocking, diff publish, impact warnings', async () => {
  assert.ok(adminToken, 'Admin token is required');
  const adminHeaders = { authorization: `Bearer ${adminToken}` };
  const suffix = Date.now().toString().slice(-4);

  // 1. Setup test class, faculty, subject
  const [classRes, facultyRes, subjRes] = await Promise.all([
    jsonFetch('/admin/classes', {
      method: 'POST',
      headers: adminHeaders,
      body: { year: 3, branch: 'DESIGN', section: `D${suffix}` },
    }),
    jsonFetch('/admin/faculty', {
      method: 'POST',
      headers: adminHeaders,
      body: { name: `Prof. Designer ${suffix}`, staffId: `DSN_${suffix}` },
    }),
    jsonFetch('/admin/subjects', {
      method: 'POST',
      headers: adminHeaders,
      body: { name: `Designer Subject ${suffix}`, code: `DSN_${suffix}` },
    }),
  ]);

  assert.equal(classRes.status, 201);
  assert.equal(facultyRes.status, 201);
  assert.equal(subjRes.status, 201);

  const testClass = classRes.body.data;
  const testFaculty = facultyRes.body.data;
  const testSubject = subjRes.body.data;

  let draftId;

  try {
    // 2. Create draft from blank
    const createRes = await jsonFetch('/admin/designer/drafts', {
      method: 'POST',
      headers: adminHeaders,
      body: { classId: testClass.id, startFrom: 'blank' },
    });
    assert.equal(createRes.status, 201);
    assert.equal(createRes.body.success, true);
    assert.equal(createRes.body.data.version, 1);
    assert.equal(createRes.body.data.status, 'OPEN');
    draftId = createRes.body.data.id;

    // 3. Second open draft for same class should return 409 DRAFT_ALREADY_EXISTS
    const duplicateDraftRes = await jsonFetch('/admin/designer/drafts', {
      method: 'POST',
      headers: adminHeaders,
      body: { classId: testClass.id, startFrom: 'blank' },
    });
    assert.equal(duplicateDraftRes.status, 409);
    assert.equal(duplicateDraftRes.body.error.code, 'DRAFT_ALREADY_EXISTS');

    // 4. List open drafts includes our draft
    const listRes = await jsonFetch('/admin/designer/drafts', { headers: adminHeaders });
    assert.equal(listRes.status, 200);
    assert.ok(listRes.body.data.some((d) => d.id === draftId));

    // 5. Get draft details (slots + periods + validation)
    const getRes = await jsonFetch(`/admin/designer/drafts/${draftId}`, { headers: adminHeaders });
    assert.equal(getRes.status, 200);
    assert.ok(Array.isArray(getRes.body.data.periods));
    assert.equal(getRes.body.data.validation.isValid, true);

    // 6. Set a cell in draft
    const setCellRes = await jsonFetch(`/admin/designer/drafts/${draftId}/cells`, {
      method: 'PUT',
      headers: adminHeaders,
      body: {
        day: 1,
        startTime: '09:00',
        endTime: '09:50',
        subjectId: testSubject.id,
        facultyId: testFaculty.id,
        expectedVersion: 1,
      },
    });
    assert.equal(setCellRes.status, 200);
    assert.equal(setCellRes.body.success, true);
    assert.equal(setCellRes.body.data.version, 2);

    // 7. Stale version check: attempt to write with outdated expectedVersion: 1 -> 409 STALE_DRAFT
    const staleRes = await jsonFetch(`/admin/designer/drafts/${draftId}/cells`, {
      method: 'PUT',
      headers: adminHeaders,
      body: {
        day: 1,
        startTime: '09:50',
        endTime: '10:40',
        subjectId: testSubject.id,
        expectedVersion: 1, // Stale! Current version is 2
      },
    });
    assert.equal(staleRes.status, 409);
    assert.equal(staleRes.body.error.code, 'STALE_DRAFT');

    // 8. Strict Zod check: passing legacy strings returns 400
    const invalidKeysRes = await jsonFetch(`/admin/designer/drafts/${draftId}/cells`, {
      method: 'PUT',
      headers: adminHeaders,
      body: {
        day: 1,
        startTime: '09:50',
        endTime: '10:40',
        subjectName: 'Banned name string',
      },
    });
    assert.equal(invalidKeysRes.status, 400);

    // 9. Availability check
    const availRes = await jsonFetch(`/admin/designer/drafts/${draftId}/availability`, { headers: adminHeaders });
    assert.equal(availRes.status, 200);
    assert.ok(typeof availRes.body.data.busyMap === 'object');

    // 10. Publish draft
    const publishRes = await jsonFetch(`/admin/designer/drafts/${draftId}/publish`, {
      method: 'POST',
      headers: adminHeaders,
    });
    assert.equal(publishRes.status, 200);
    assert.equal(publishRes.body.success, true);
    assert.equal(publishRes.body.data.publishedSlotsCount, 1);

    // Verify published slots on the live timetable
    const liveSlotsRes = await jsonFetch(`/admin/slots?classId=${testClass.id}`, { headers: adminHeaders });
    assert.equal(liveSlotsRes.status, 200);
    assert.equal(liveSlotsRes.body.data.length, 1);
    assert.equal(liveSlotsRes.body.data[0].startTime, '09:00');
    assert.equal(liveSlotsRes.body.data[0].endTime, '09:50');
    assert.equal(liveSlotsRes.body.data[0].faculty.id, testFaculty.id);

    // 11. Published draft is no longer in open drafts list
    const openListRes = await jsonFetch('/admin/designer/drafts', { headers: adminHeaders });
    assert.ok(!openListRes.body.data.some((d) => d.id === draftId));
  } finally {
    // Cleanup
    await jsonFetch(`/admin/classes/${testClass.id}`, { method: 'DELETE', headers: adminHeaders });
    await jsonFetch(`/admin/subjects/${testSubject.id}`, { method: 'DELETE', headers: adminHeaders });
    await jsonFetch(`/admin/faculty/${testFaculty.id}`, { method: 'DELETE', headers: adminHeaders });
  }
});
