const test = require('node:test');
const assert = require('node:assert/strict');
const { requireCR, requireAdmin, requireAdminOrCR, requireCRClassAccess } = require('../src/middleware/auth');

function createMockRes() {
  const headers = {};
  const res = {
    statusCode: 200,
    body: null,
    headers,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

test('requireAdmin: permits user with ADMIN role', () => {
  const req = { user: { id: 1, role: 'ADMIN' } };
  const res = createMockRes();
  let nextCalled = false;

  requireAdmin(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test('requireAdmin: denies user with CR role with 403 FORBIDDEN', () => {
  const req = { user: { id: 2, role: 'CR', classId: 1 } };
  const res = createMockRes();
  let nextCalled = false;

  requireAdmin(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'FORBIDDEN');
});

test('requireAdmin: denies unauthenticated request (no user)', () => {
  const req = {};
  const res = createMockRes();
  let nextCalled = false;

  requireAdmin(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, 'FORBIDDEN');
});

test('requireCR: permits user with CR role', () => {
  const req = { user: { id: 2, role: 'CR', classId: 1 } };
  const res = createMockRes();
  let nextCalled = false;

  requireCR(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test('requireCR: denies user with ADMIN role (dedicated CR endpoint)', () => {
  const req = { user: { id: 1, role: 'ADMIN' } };
  const res = createMockRes();
  let nextCalled = false;

  requireCR(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, 'FORBIDDEN');
});

test('requireAdminOrCR: permits both ADMIN and CR roles', () => {
  const adminReq = { user: { id: 1, role: 'ADMIN' } };
  const crReq = { user: { id: 2, role: 'CR' } };

  let adminNext = false;
  requireAdminOrCR(adminReq, createMockRes(), () => { adminNext = true; });
  assert.equal(adminNext, true);

  let crNext = false;
  requireAdminOrCR(crReq, createMockRes(), () => { crNext = true; });
  assert.equal(crNext, true);
});

test('requireCRClassAccess: permits CR accessing their own assigned class', () => {
  const req = {
    user: { id: 5, role: 'CR', classId: 1 },
    params: { classId: '1' },
  };
  const res = createMockRes();
  let nextCalled = false;

  requireCRClassAccess(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
});

test('requireCRClassAccess: denies CR attempting to access a different classId', () => {
  const req = {
    user: { id: 5, role: 'CR', classId: 1 },
    params: { classId: '2' },
  };
  const res = createMockRes();
  let nextCalled = false;

  requireCRClassAccess(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'FORBIDDEN');
  assert.equal(res.body.error.message, 'You do not have access to this class');
});

test('requireCRClassAccess: allows ADMIN to access any class', () => {
  const req = {
    user: { id: 1, role: 'ADMIN' },
    params: { classId: '99' },
  };
  const res = createMockRes();
  let nextCalled = false;

  requireCRClassAccess(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
});
