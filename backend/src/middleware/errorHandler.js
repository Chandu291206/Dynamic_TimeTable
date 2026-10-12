const logger = require('../utils/logger');

function errorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
  const status = error.statusCode || error.status || 500;
  if (process.env.NODE_ENV !== 'test') {
    logger.error(error.message, {
      method: req.method,
      url: req.originalUrl,
      status,
      code: error.code || 'INTERNAL_ERROR',
      stack: error.stack,
    });
  }

  if (error.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Origin not allowed by CORS policy',
      },
    });
  }

  if (error.name === 'ZodError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        fields: error.flatten ? error.flatten().fieldErrors : undefined,
      },
    });
  }

  const payload = {
    code: error.code || (status === 500 ? 'INTERNAL_ERROR' : 'ERROR'),
    message: status === 500 ? 'An unexpected error occurred' : error.message,
  };
  if (error.fields) {
    payload.fields = error.fields;
  }

  return res.status(status).json({
    success: false,
    error: payload,
  });
}

module.exports = errorHandler;
