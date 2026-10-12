const logger = require('../utils/logger');

function requestLogger(req, res, next) {
  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const durationMs = Number((endTime - startTime) / 1000000n);

    const clientIp = req.headers['x-forwarded-for']
      ? req.headers['x-forwarded-for'].split(',')[0].trim()
      : req.socket?.remoteAddress || req.ip || 'unknown';

    const logPayload = {
      timestamp: new Date().toISOString(),
      method: req.method,
      endpoint: req.originalUrl || req.url,
      status: res.statusCode,
      duration: `${durationMs}ms`,
      durationMs,
      userRole: req.user?.role || 'ANONYMOUS',
      userId: req.user?.id || null,
      ip: clientIp,
    };

    if (res.statusCode >= 500) {
      logger.error(`${req.method} ${req.originalUrl} - ${res.statusCode} (${durationMs}ms)`, logPayload);
    } else if (res.statusCode >= 400) {
      logger.warn(`${req.method} ${req.originalUrl} - ${res.statusCode} (${durationMs}ms)`, logPayload);
    } else {
      logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} (${durationMs}ms)`, logPayload);
    }
  });

  next();
}

module.exports = requestLogger;
