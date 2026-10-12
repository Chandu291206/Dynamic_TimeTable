const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { createRateLimiter } = require('../src/middleware/rateLimit');
const securityHeaders = require('../src/middleware/securityHeaders');
const { safeUser } = require('../src/services/auth.service');
const { createFacultySchema } = require('../src/validators/faculty.schema');

function createMockRes() {
  const headers = {};
  const res = {
    statusCode: 200,
    body: null,
    headers,
    setHeader(name, value) {
      headers[name.toLowerCase()] = value;
      return this;
    },
    set(name, value) {
      return this.setHeader(name, value);
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

test('securityHeaders middleware sets expected OWASP headers', () => {
  const req = {};
  const res = createMockRes();
  let nextCalled = false;

  securityHeaders(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.equal(res.headers['x-frame-options'], 'DENY');
  assert.equal(res.headers['x-xss-protection'], '0');
  assert.equal(res.headers['referrer-policy'], 'strict-origin-when-cross-origin');
  assert.ok(res.headers['permissions-policy']);
});

test('rateLimiter permits allowed requests and blocks exceeding requests with 429', () => {
  const limiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 2,
    message: 'Rate limit exceeded for test',
  });

  const req = { headers: {}, socket: { remoteAddress: '192.168.1.100' } };

  // Request 1: Allowed
  const res1 = createMockRes();
  let next1Called = false;
  limiter(req, res1, () => { next1Called = true; });
  assert.equal(next1Called, true);
  assert.equal(res1.headers['ratelimit-remaining'], 1);

  // Request 2: Allowed
  const res2 = createMockRes();
  let next2Called = false;
  limiter(req, res2, () => { next2Called = true; });
  assert.equal(next2Called, true);
  assert.equal(res2.headers['ratelimit-remaining'], 0);

  // Request 3: Blocked (429)
  const res3 = createMockRes();
  let next3Called = false;
  limiter(req, res3, () => { next3Called = true; });
  assert.equal(next3Called, false);
  assert.equal(res3.statusCode, 429);
  assert.equal(res3.body.success, false);
  assert.equal(res3.body.error.code, 'TOO_MANY_REQUESTS');
  assert.equal(res3.body.error.message, 'Rate limit exceeded for test');
  assert.ok(res3.headers['retry-after']);
});

test('safeUser completely excludes passwordHash and sensitive fields', () => {
  const sensitiveUser = {
    id: 42,
    username: 'cr_test',
    passwordHash: '$2b$12$eX4mPL3H4shVaLu3Th4tSh0uldN3v3rB3ExP0s3D',
    role: 'CR',
    classId: 7,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sanitized = safeUser(sensitiveUser);
  assert.equal(sanitized.id, 42);
  assert.equal(sanitized.username, 'cr_test');
  assert.equal(sanitized.role, 'CR');
  assert.equal(sanitized.classId, 7);
  assert.equal(sanitized.passwordHash, undefined);
  assert.equal('passwordHash' in sanitized, false);
});

test('faculty schema validates safe HTTP/HTTPS URLs and rejects unsafe protocols', () => {
  // Valid HTTPS URL
  const validResult = createFacultySchema.safeParse({
    name: 'Dr. John Doe',
    imageSourceUrl: 'https://www.griet.ac.in/images/staff/101.jpg',
  });
  assert.equal(validResult.success, true);
  assert.equal(validResult.data.imageSourceUrl, 'https://www.griet.ac.in/images/staff/101.jpg');

  // Empty string URL converts to null
  const emptyResult = createFacultySchema.safeParse({
    name: 'Dr. Jane Doe',
    imageSourceUrl: '',
  });
  assert.equal(emptyResult.success, true);
  assert.equal(emptyResult.data.imageSourceUrl, null);

  // XSS javascript: URL is rejected
  const xssResult = createFacultySchema.safeParse({
    name: 'Malicious Faculty',
    imageSourceUrl: 'javascript:alert(1)',
  });
  assert.equal(xssResult.success, false);

  // file: protocol URL is rejected
  const fileResult = createFacultySchema.safeParse({
    name: 'Local File Faculty',
    imageSourceUrl: 'file:///etc/passwd',
  });
  assert.equal(fileResult.success, false);
});
