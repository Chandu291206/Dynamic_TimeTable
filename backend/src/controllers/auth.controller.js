const authService = require('../services/auth.service');
const { loginSchema } = require('../validators/auth.schema');
const logger = require('../utils/logger');

async function login(req, res) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Username and password are required', fields: parsed.error.flatten().fieldErrors } });
  }

  const session = await authService.login(parsed.data.username, parsed.data.password);
  if (!session) {
    const isCrPath = req.originalUrl?.includes('/cr/');
    const isAdminPath = req.originalUrl?.includes('/admin/');
    const failureEvent = isCrPath ? 'CR_LOGIN_FAILURE' : (isAdminPath ? 'ADMIN_LOGIN_FAILURE' : 'LOGIN_FAILURE');
    logger.audit(failureEvent, { username: parsed.data.username, path: req.originalUrl });
    return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' } });
  }

  const eventName = session.user.role === 'ADMIN' ? 'ADMIN_LOGIN_SUCCESS' : 'CR_LOGIN_SUCCESS';
  logger.audit(eventName, { username: session.user.username, role: session.user.role, classId: session.user.classId, userId: session.user.id });

  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('token', session.token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
  });

  return res.json({ success: true, data: session });
}

function logout(req, res) {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/',
  });
  return res.json({ success: true, data: { message: 'Logged out. Discard the bearer token on the client.' } });
}

function me(req, res) {
  return res.json({ success: true, data: { user: req.user } });
}

module.exports = { login, logout, me };
