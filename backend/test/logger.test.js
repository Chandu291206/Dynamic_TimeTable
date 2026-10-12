const test = require('node:test');
const assert = require('node:assert/strict');
const logger = require('../src/utils/logger');

test('logger.sanitize redacts sensitive credentials and tokens', () => {
  const sensitiveData = {
    username: 'admin',
    password: 'SuperSecretPassword123!',
    passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
    token: 'jwt-token-string',
    secret: 'session-secret',
    nested: {
      cookie: 'connect.sid=12345',
      authorization: 'Bearer eyJhbGciOi...',
      safeField: 'visible',
      innerList: [
        { password: 'nestedPassword', normal: 42 }
      ]
    }
  };

  const clean = logger.sanitize(sensitiveData);

  assert.equal(clean.username, 'admin');
  assert.equal(clean.password, '[REDACTED]');
  assert.equal(clean.passwordHash, '[REDACTED]');
  assert.equal(clean.token, '[REDACTED]');
  assert.equal(clean.secret, '[REDACTED]');
  assert.equal(clean.nested.cookie, '[REDACTED]');
  assert.equal(clean.nested.authorization, '[REDACTED]');
  assert.equal(clean.nested.safeField, 'visible');
  assert.equal(clean.nested.innerList[0].password, '[REDACTED]');
  assert.equal(clean.nested.innerList[0].normal, 42);
});

test('logger.sanitize handles primitives, null, and dates safely', () => {
  assert.equal(logger.sanitize(null), null);
  assert.equal(logger.sanitize(undefined), undefined);
  assert.equal(logger.sanitize(123), 123);
  assert.equal(logger.sanitize('string'), 'string');

  const now = new Date();
  assert.equal(logger.sanitize(now), now.toISOString());
});

test('logger.formatLog formats production logs as JSON with sanitized metadata', () => {
  const prevEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    const raw = logger.formatLog('AUDIT', 'User login attempt', {
      user: 'admin',
      password: 'mypassword',
      ip: '127.0.0.1'
    });

    const parsed = JSON.parse(raw);
    assert.equal(parsed.level, 'AUDIT');
    assert.equal(parsed.message, 'User login attempt');
    assert.equal(parsed.user, 'admin');
    assert.equal(parsed.password, '[REDACTED]');
    assert.equal(parsed.ip, '127.0.0.1');
    assert.ok(parsed.timestamp);
  } finally {
    process.env.NODE_ENV = prevEnv;
  }
});

test('logger.formatLog formats non-production logs with human readable prefixes', () => {
  const prevEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'development';
    const formatted = logger.formatLog('INFO', 'Test log event', { action: 'test' });
    assert.match(formatted, /^\[\d{4}-\d{2}-\d{2}T.*\] \[INFO\] Test log event \{"action":"test"\}/);
  } finally {
    process.env.NODE_ENV = prevEnv;
  }
});

test('logger audit events comply with Section 39 requirements', () => {
  const prevEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    const requiredEvents = [
      { event: 'CR_LOGIN_SUCCESS', meta: { username: 'cr_cse_a', role: 'CR', classId: 1 } },
      { event: 'CR_LOGIN_FAILURE', meta: { username: 'cr_cse_a', path: '/api/auth/cr/login' } },
      { event: 'ADMIN_LOGIN_SUCCESS', meta: { username: 'admin', role: 'ADMIN' } },
      { event: 'ADMIN_LOGIN_FAILURE', meta: { username: 'admin', path: '/api/auth/admin/login' } },
      { event: 'LOGIN_FAILURE', meta: { username: 'intruder', path: '/api/auth/login' } },
      { event: 'OVERRIDE_CREATED', meta: { overrideId: 10, classId: 1, date: '2026-10-08', startTime: '09:00', endTime: '10:00' } },
      { event: 'OVERRIDE_DELETED', meta: { overrideId: 10, classId: 1, crUserId: 2 } },
      { event: 'FACULTY_CREATED', meta: { facultyId: 5, name: 'Dr. John', staffId: 'GRIET123' } },
      { event: 'FACULTY_UPDATED', meta: { facultyId: 5, name: 'Dr. John Updated' } },
      { event: 'FACULTY_DELETED', meta: { facultyId: 5, name: 'Dr. John' } },
      { event: 'SUBJECT_CREATED', meta: { subjectId: 8, name: 'Cloud Computing' } },
      { event: 'SUBJECT_UPDATED', meta: { subjectId: 8, name: 'Cloud Computing Advanced' } },
      { event: 'SUBJECT_DELETED', meta: { subjectId: 8, name: 'Cloud Computing' } },
      { event: 'CLASS_CREATED', meta: { classId: 3, label: 'Year 3 - CSE - A' } },
      { event: 'CLASS_UPDATED', meta: { classId: 3, label: 'Year 3 - CSE - B' } },
      { event: 'CLASS_DELETED', meta: { classId: 3, label: 'Year 3 - CSE - A' } },
      { event: 'SLOT_CREATED', meta: { slotId: 42, classId: 1, day: 0, startTime: '09:00', endTime: '10:00' } },
      { event: 'SLOT_UPDATED', meta: { slotId: 42, classId: 1, day: 0, startTime: '09:00', endTime: '10:00' } },
      { event: 'SLOT_DELETED', meta: { slotId: 42, classId: 1, day: 0 } },
      { event: 'CR_USER_CREATED', meta: { crUserId: 4, username: 'cr4', classId: 1 } },
      { event: 'CR_USER_UPDATED', meta: { crUserId: 4, username: 'cr4_updated', classId: 1 } },
      { event: 'CR_CLASS_ASSIGNED', meta: { crUserId: 4, classId: 2 } },
      { event: 'CR_USER_DELETED', meta: { crUserId: 4 } },
    ];

    for (const item of requiredEvents) {
      const output = logger.formatLog('AUDIT', `[AUDIT_EVENT] ${item.event}`, {
        event: item.event,
        ...item.meta,
      });
      const parsed = JSON.parse(output);
      assert.equal(parsed.level, 'AUDIT');
      assert.equal(parsed.event, item.event);
      assert.ok(parsed.timestamp);
      assert.equal(parsed.message, `[AUDIT_EVENT] ${item.event}`);
    }
  } finally {
    process.env.NODE_ENV = prevEnv;
  }
});

test('logger.sanitize redacts compound sensitive keys', () => {
  const data = {
    adminPassword: 'secretPassword123',
    jwt_token: 'xyz-token',
    access_token: 'abc-access',
    sessionSecret: 'my-session-secret',
    userPasswordHash: '$2b$10$hashvalue',
    authCookie: 'connect.sid=val',
    safeName: 'AIML-B',
    safeCount: 15,
  };

  const clean = logger.sanitize(data);
  assert.equal(clean.adminPassword, '[REDACTED]');
  assert.equal(clean.jwt_token, '[REDACTED]');
  assert.equal(clean.access_token, '[REDACTED]');
  assert.equal(clean.sessionSecret, '[REDACTED]');
  assert.equal(clean.userPasswordHash, '[REDACTED]');
  assert.equal(clean.authCookie, '[REDACTED]');
  assert.equal(clean.safeName, 'AIML-B');
  assert.equal(clean.safeCount, 15);
});

test('requestLogger logs expected HTTP request metadata and user role', () => {
  const requestLogger = require('../src/middleware/requestLogger');

  let loggedMessage = '';
  let loggedPayload = null;

  const originalInfo = logger.info;
  logger.info = (msg, payload) => {
    loggedMessage = msg;
    loggedPayload = payload;
  };

  try {
    const listeners = {};
    const req = {
      method: 'GET',
      originalUrl: '/api/classes',
      headers: {},
      ip: '127.0.0.1',
      user: { id: 10, role: 'CR' },
    };
    const res = {
      statusCode: 200,
      on: (event, handler) => {
        listeners[event] = handler;
      },
    };

    let nextCalled = false;
    requestLogger(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true, 'requestLogger should call next()');
    assert.ok(listeners.finish, 'requestLogger should attach finish listener');

    // Simulate response finish
    listeners.finish();

    assert.ok(loggedPayload, 'Should log payload on finish');
    assert.equal(loggedPayload.method, 'GET');
    assert.equal(loggedPayload.endpoint, '/api/classes');
    assert.equal(loggedPayload.status, 200);
    assert.equal(loggedPayload.userRole, 'CR');
    assert.equal(loggedPayload.userId, 10);
    assert.ok(loggedPayload.duration);
    assert.ok(loggedPayload.timestamp);
  } finally {
    logger.info = originalInfo;
  }
});


