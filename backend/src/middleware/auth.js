const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');
const authService = require('../services/auth.service');

function unauthorized(res, message = 'Authentication required') {
  return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message } });
}

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  const cookies = {};
  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rest] = part.split('=');
    if (rawName && rest.length > 0) {
      cookies[rawName.trim()] = decodeURIComponent(rest.join('=').trim());
    }
  }
  return cookies;
}

async function authenticateJWT(req, res, next) {
  let token = null;
  const authorization = req.get('authorization');
  if (authorization && authorization.startsWith('Bearer ')) {
    token = authorization.slice(7).trim();
  } else if (req.headers.cookie) {
    const cookies = parseCookies(req.headers.cookie);
    token = cookies.token || cookies.tt_token;
  }

  if (!token) return unauthorized(res);

  try {
    const claims = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
    const userId = Number(claims.sub);
    if (!Number.isInteger(userId) || userId <= 0) return unauthorized(res, 'Invalid authentication token');

    const user = await authService.getActiveUser(userId);
    if (!user) return unauthorized(res, 'Account is unavailable');
    req.user = user;
    return next();
  } catch (error) {
    return unauthorized(res, 'Invalid or expired authentication token');
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to perform this action' } });
    }
    return next();
  };
}

const requireCR = requireRole('CR');
const requireAdmin = requireRole('ADMIN');
const requireAdminOrCR = requireRole('ADMIN', 'CR');

function requireCRClassAccess(req, res, next) {
  if (req.user?.role === 'ADMIN') return next();
  const requestedClassId = Number(req.params.classId || req.body?.classId || req.query.classId);
  if (req.user?.role !== 'CR' || !Number.isInteger(requestedClassId) || requestedClassId !== req.user.classId) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this class' } });
  }
  return next();
}

module.exports = { authenticateJWT, requireCR, requireAdmin, requireAdminOrCR, requireCRClassAccess };
