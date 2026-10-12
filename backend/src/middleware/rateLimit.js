function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 10,
  message = 'Too many login attempts. Please try again later.',
  statusCode = 429,
  keyGenerator = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress || req.ip || 'unknown';
    return ip;
  },
} = {}) {
  const hits = new Map();

  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (now > record.resetTime) {
        hits.delete(key);
      }
    }
  }, 5 * 60 * 1000);
  if (cleanupTimer.unref) cleanupTimer.unref();

  const middleware = (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();
    let record = hits.get(key);

    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + windowMs };
      hits.set(key, record);
    }

    record.count += 1;
    const remaining = Math.max(0, max - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', remaining);
    res.setHeader('RateLimit-Reset', resetSeconds);

    if (record.count > max) {
      res.setHeader('Retry-After', resetSeconds);
      return res.status(statusCode).json({
        success: false,
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: typeof message === 'function' ? message(resetSeconds) : message,
        },
      });
    }

    return next();
  };

  middleware.reset = () => hits.clear();
  middleware.getRecord = (key) => hits.get(key);

  return middleware;
}

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: (seconds) => `Too many login attempts. Please try again in ${Math.ceil(seconds / 60)} minute(s).`,
});

module.exports = { createRateLimiter, authLimiter };
