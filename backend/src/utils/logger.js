// Structured Logger for Timetable Management System
// Enforces sanitization of sensitive values and standard formatting

const SENSITIVE_KEY_PATTERN = /(password|passwd|passwordhash|secret|sessionsecret|jwt|token|bearer|authorization|cookie)/i;

function sanitize(data) {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;
  if (data instanceof Date) return data.toISOString();

  if (Array.isArray(data)) {
    return data.map((item) => sanitize(item));
  }

  const clean = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      clean[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitize(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

function formatLog(level, message, metadata = {}) {
  const timestamp = new Date().toISOString();
  const cleanMeta = sanitize(metadata);

  if (process.env.NODE_ENV === 'production') {
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...cleanMeta,
    });
  }

  const metaStr = Object.keys(cleanMeta).length ? ` ${JSON.stringify(cleanMeta)}` : '';
  return `[${timestamp}] [${level}] ${message}${metaStr}`;
}

const logger = {
  info(message, metadata = {}) {
    if (process.env.NODE_ENV === 'test') return;
    console.log(formatLog('INFO', message, metadata));
  },

  warn(message, metadata = {}) {
    if (process.env.NODE_ENV === 'test') return;
    console.warn(formatLog('WARN', message, metadata));
  },

  error(message, metadata = {}) {
    if (process.env.NODE_ENV === 'test') return;
    console.error(formatLog('ERROR', message, metadata));
  },

  audit(event, metadata = {}) {
    if (process.env.NODE_ENV === 'test') return;
    console.log(formatLog('AUDIT', `[AUDIT_EVENT] ${event}`, { event, ...metadata }));
  },

  sanitize,
  formatLog,
};

module.exports = logger;
