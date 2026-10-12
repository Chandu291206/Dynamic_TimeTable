const test = require('node:test');
const assert = require('node:assert/strict');
const errorHandler = require('../src/middleware/errorHandler');
const notFound = require('../src/middleware/notFound');

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
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

test('notFound returns standardized 404 envelope', () => {
  const req = { method: 'GET', originalUrl: '/api/unknown' };
  const res = createMockRes();
  notFound(req, res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'NOT_FOUND');
  assert.match(res.body.error.message, /Route GET \/api\/unknown was not found/);
});

test('errorHandler standardizes internal 500 errors', () => {
  const error = new Error('Database connection timed out');
  const req = {};
  const res = createMockRes();
  errorHandler(error, req, res, () => {});

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'INTERNAL_ERROR');
  assert.equal(res.body.error.message, 'An unexpected error occurred');
});

test('errorHandler handles validation errors with fields', () => {
  const error = new Error('Invalid start time');
  error.statusCode = 400;
  error.code = 'VALIDATION_ERROR';
  error.fields = { startTime: ['Start time must be before end time'] };

  const req = {};
  const res = createMockRes();
  errorHandler(error, req, res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  assert.equal(res.body.error.message, 'Invalid start time');
  assert.deepEqual(res.body.error.fields, { startTime: ['Start time must be before end time'] });
});
